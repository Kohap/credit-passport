#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/apps/web/src/app/api"
BACKUP_DIR="${TMPDIR:-/tmp}/credit-passport-pages-api-$$"

restore_api() {
  if [[ -d "$BACKUP_DIR" ]]; then
    rm -rf "$API_DIR"
    mv "$BACKUP_DIR" "$API_DIR"
  fi
}
trap restore_api EXIT

# Static hosting cannot run Next API routes. The client already falls back to
# direct public provers when the same-origin hosted route is absent.
mv "$API_DIR" "$BACKUP_DIR"
GITHUB_PAGES=true npm run build --workspace=apps/web
