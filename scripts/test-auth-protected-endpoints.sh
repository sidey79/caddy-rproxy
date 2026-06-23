#!/usr/bin/env bash
set -euo pipefail

CADDYFILE="${1:-caddy/Caddyfile}"

if [[ ! -f "$CADDYFILE" ]]; then
  echo "ERROR: Caddyfile not found: $CADDYFILE" >&2
  exit 1
fi

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

has_fixed_string() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -n --fixed-strings "$pattern" "$file" >/dev/null
  else
    grep -nF -- "$pattern" "$file" >/dev/null
  fi
}

require_pattern() {
  local pattern="$1"
  local msg="$2"
  if ! has_fixed_string "$pattern" "$CADDYFILE"; then
    fail "$msg"
  fi
}

forbid_pattern() {
  local pattern="$1"
  local msg="$2"
  if has_fixed_string "$pattern" "$CADDYFILE"; then
    fail "$msg"
  fi
}

# Landing host must expose only narrow backup aliases and protect them via Authelia.
require_pattern "path /backup/status" "Missing landing alias /backup/status"
require_pattern "path /backup/names" "Missing landing alias /backup/names"
forbid_pattern "path /backup/*" "Broad /backup/* alias is forbidden on landing host"
require_pattern "rewrite * /webhook/backup/status-public" "Missing rewrite for /backup/status"
require_pattern "rewrite * /webhook/backup/names" "Missing rewrite for /backup/names"
require_pattern "handle @landingBackupStatus {" "Missing landingBackupStatus handle"
require_pattern "handle @landingBackupNames {" "Missing landingBackupNames handle"

# FHEM image auth must keep the original URL through Authelia before strip_prefix runs.
require_pattern "Keep auth before the static rewrite so Authelia sees the original FHEM URL." "Missing FHEM image auth ordering guard"
require_pattern "try_files {path} /__fhem_backend/fhem{uri}" "Missing FHEM image backend fallback"
require_pattern "handle_path /__fhem_backend/* {" "Missing FHEM image backend proxy handler"

# Workflow host webhook protections must remain explicit.
require_pattern 'header X-Telegram-Bot-Api-Secret-Token {$TELEGRAM_WEBHOOK_SECRET}' 'Missing Telegram secret header matcher'
require_pattern "path /webhook/scanservjs/telegram/reissue /webhook-test/scanservjs/telegram/reissue" "Missing Telegram webhook path matcher"
require_pattern "handle @webhooksAuthelia {" "Missing Authelia webhook handling branch"
require_pattern "import authelia_forward_auth" "Missing authelia_forward_auth import"

# Quick structural sanity for webhook mTLS split (must both exist).
require_pattern "@webhooksMtls {" "Missing mTLS webhook matcher"
require_pattern "@webhooksAuthelia {" "Missing non-mTLS webhook matcher"

echo "Auth endpoint policy checks passed: $CADDYFILE"
