#!/bin/sh

set -eu

target_dir="/target/workflow/assets"
target_file="$target_dir/github-pr-dashboard.css"
repo_path="projects/GitHubPrDashboard/assets/github-pr-dashboard.css"
ref="${GITHUB_ASSET_REF:-main}"
url="https://api.github.com/repos/sidey79/n8n_wf_build/contents/${repo_path}?ref=${ref}"

log_context() {
  echo "Asset fetch failed" >&2
  echo "  ref: $ref" >&2
  echo "  url: $url" >&2
  echo "  target: $target_file" >&2
}

if [ -z "${GITHUB_TOKEN:-}" ]; then
  log_context
  echo "GITHUB_TOKEN is required" >&2
  exit 1
fi

mkdir -p "$target_dir"

if ! curl -fsSL \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.raw" \
  "$url" \
  -o "$target_file"; then
  log_context
  exit 1
fi

echo "Fetched $target_file from ref $ref"
