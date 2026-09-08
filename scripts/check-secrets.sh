#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# High-confidence credential formats plus assignments of common secret variables.
PATTERN='-----BEGIN( [A-Z]+)? PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|(PRIVATE_KEY|SECRET|API[_-]?KEY|TOKEN|PASSWORD)[[:space:]]*[:=][[:space:]]*(0x[0-9a-fA-F]{64}|[A-Za-z0-9_./+=-]{16,})'

found=0

report_matches() {
  local scope="$1"
  shift
  local matches
  local status=0
  matches="$("$@")" || status=$?
  if [[ "$status" -ne 0 && "$status" -ne 1 ]]; then
    printf 'Secret scan command failed while checking %s.\n' "$scope" >&2
    exit "$status"
  fi
  if [[ -n "$matches" ]]; then
    printf 'Potential secret in %s:\n%s\n' "$scope" "$matches" >&2
    found=1
  fi
}

report_matches "tracked files" git grep -I -l -E -e "$PATTERN" -- . ':(exclude).env.example'

while IFS= read -r commit; do
  report_matches "commit $commit" \
    git grep -I -l -E -e "$PATTERN" "$commit" -- . ':(exclude).env.example'
done < <(git rev-list --all)

while IFS= read -r -d '' env_file; do
  [[ "$(basename "$env_file")" == ".env.example" ]] && continue
  report_matches "local file ${env_file#./}" rg -l -I -E "$PATTERN" "$env_file"
done < <(find . -type f -name '.env*' -print0)

if [[ "$found" -ne 0 ]]; then
  echo "Secret scan failed. Revoke any real credential before rewriting history." >&2
  exit 1
fi

echo "Secret scan passed."
