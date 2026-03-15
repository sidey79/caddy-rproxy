#!/bin/sh

set -eu

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN is required" >&2
  exit 1
fi

target_dir="/target/workflow/assets"
target_file="$target_dir/github-pr-dashboard.css"
repo_path="projects/GitHubPrDashboard/assets/github-pr-dashboard.css"
ref="${GITHUB_ASSET_REF:-main}"
url="https://api.github.com/repos/sidey79/n8n_wf_build/contents/${repo_path}?ref=${ref}"

mkdir -p "$target_dir"

curl -fsSL \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.raw" \
  "$url" \
  -o "$target_file"

echo "Fetched $target_file from ref $ref"
