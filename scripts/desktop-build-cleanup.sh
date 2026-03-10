#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_OUT_DIR="$ROOT/release/mac-arm64"
APP_BUNDLE="$APP_OUT_DIR/Flider.app"

# Keep DMG artifacts, remove only the unpacked app bundle that can show up
# as a second local app entry on builder machines.
if [[ -d "$APP_BUNDLE" ]]; then
  rm -rf "$APP_BUNDLE"
  echo "Removed local build app bundle: $APP_BUNDLE"
fi

