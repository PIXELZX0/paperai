#!/bin/sh

set -eu

BROWSER_BIN="${PAPERAI_HEADLESS_BROWSER_BIN:-/usr/bin/chromium}"

if ! command -v "$BROWSER_BIN" >/dev/null 2>&1; then
  echo "paperai-browser: browser binary not found: $BROWSER_BIN" >&2
  exit 127
fi

PROFILE_DIR="$(mktemp -d /tmp/paperai-chromium-XXXXXX)"

cleanup() {
  rm -rf "$PROFILE_DIR"
}

trap cleanup EXIT INT TERM

"$BROWSER_BIN" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --disable-dev-shm-usage \
  --hide-scrollbars \
  --user-data-dir="$PROFILE_DIR" \
  "$@"
