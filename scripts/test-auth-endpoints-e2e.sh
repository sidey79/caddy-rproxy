#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/tests/e2e/docker-compose.e2e.yml"
BASE_URL="http://127.0.0.1:18080"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

req_code() {
  local method="$1" host="$2" path="$3" auth="$4" extra_header="${5:-}"
  local -a args=( -sS -o /dev/null -w "%{http_code}" -X "$method" -H "Host: $host" )
  if [[ "$auth" == "auth" ]]; then
    args+=( -H "X-Test-Auth: allow" )
  fi
  if [[ -n "$extra_header" ]]; then
    args+=( -H "$extra_header" )
  fi
  curl "${args[@]}" "$BASE_URL$path"
}

req_header() {
  local method="$1" host="$2" path="$3" auth="$4" header_name="$5" extra_header="${6:-}"
  local -a args=( -sS -D - -o /dev/null -X "$method" -H "Host: $host" )
  if [[ "$auth" == "auth" ]]; then
    args+=( -H "X-Test-Auth: allow" )
  fi
  if [[ -n "$extra_header" ]]; then
    args+=( -H "$extra_header" )
  fi
  curl "${args[@]}" "$BASE_URL$path" | awk -v h="$header_name" 'BEGIN{IGNORECASE=1} $0 ~ "^"h":" {print; found=1} END{if(!found) exit 1}'
}

assert_eq() {
  local got="$1" want="$2" msg="$3"
  if [[ "$got" != "$want" ]]; then
    echo "FAIL: $msg (got=$got want=$want)" >&2
    exit 1
  fi
  echo "OK: $msg -> $got"
}

assert_no_upstream_header() {
  local method="$1" host="$2" path="$3" auth="$4"
  if req_header "$method" "$host" "$path" "$auth" "X-Upstream" >/dev/null 2>&1; then
    echo "FAIL: unexpected upstream proxy for $host$path" >&2
    exit 1
  fi
  echo "OK: no upstream proxy header for $host$path"
}

wait_for_code() {
  local method="$1" host="$2" path="$3" auth="$4" want="$5"
  local attempts=30
  local delay=1
  local got=""

  for _ in $(seq 1 "$attempts"); do
    got="$(req_code "$method" "$host" "$path" "$auth")"
    if [[ "$got" == "$want" ]]; then
      echo "OK: ready $method $host$path -> $got"
      return 0
    fi
    if [[ "$got" != "502" && "$got" != "503" && "$got" != "504" ]]; then
      break
    fi
    sleep "$delay"
  done

  echo "FAIL: $method $host$path ready check (got=$got want=$want)" >&2
  exit 1
}

echo "Starting isolated E2E stack..."
docker compose -f "$COMPOSE_FILE" up -d --wait

# landing.* protected endpoints
wait_for_code GET landing.test /backup/status none 401
assert_eq "$(req_code GET landing.test /backup/status none)" "401" "landing /backup/status requires auth"
assert_eq "$(req_code GET landing.test /backup/status auth)" "200" "landing /backup/status works with auth"
assert_eq "$(req_code GET landing.test /backup/names none)" "401" "landing /backup/names requires auth"
assert_eq "$(req_code GET landing.test /backup/names auth)" "200" "landing /backup/names works with auth"
assert_eq "$(req_code GET landing.test /api/me none)" "401" "landing /api/me requires auth"
assert_eq "$(req_code GET landing.test /api/me auth)" "200" "landing /api/me works with auth"

# Ensure no broad /backup/* passthrough remains
assert_eq "$(req_code GET landing.test /backup/rest/workflows auth)" "404" "landing /backup/rest/workflows is not proxied"
assert_no_upstream_header GET landing.test /backup/rest/workflows auth

# workflow.* protected webhook path
assert_eq "$(req_code POST workflow.test /webhook/protected none)" "401" "workflow protected webhook requires auth without mTLS/exception"
assert_eq "$(req_code POST workflow.test /webhook/protected auth)" "200" "workflow protected webhook works with auth"

# Explicit Telegram exception (no auth but header secret)
assert_eq "$(req_code POST workflow.test /webhook/scanservjs/telegram/reissue none "X-Telegram-Bot-Api-Secret-Token: test-telegram-secret")" "200" "telegram exception works without auth when secret header matches"
assert_eq "$(req_code POST workflow.test /webhook/scanservjs/telegram/reissue none)" "401" "telegram path without secret remains protected"

echo "All E2E auth endpoint checks passed."
