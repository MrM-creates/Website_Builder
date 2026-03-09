#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Autostart via LaunchAgent wird nur auf macOS unterstuetzt."
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_ID="ch.flatsite.devstack"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_DIR/${AGENT_ID}.plist"
LOG_DIR="$ROOT/.runtime/logs"

mkdir -p "$LAUNCH_DIR" "$LOG_DIR"

NPM_BIN="$(command -v npm || true)"
ZSH_BIN="$(command -v zsh || true)"

if [[ -z "$NPM_BIN" ]]; then
  echo "npm wurde nicht gefunden. Bitte Node.js/npm zuerst installieren."
  exit 1
fi

if [[ -z "$ZSH_BIN" ]]; then
  ZSH_BIN="/bin/zsh"
fi

LAUNCH_CMD="cd \"$ROOT\" && \"$NPM_BIN\" run dev:bg"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AGENT_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${ZSH_BIN}</string>
    <string>-lc</string>
    <string>${LAUNCH_CMD}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/autostart.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/autostart.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${AGENT_ID}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/${AGENT_ID}" >/dev/null 2>&1 || true

echo "Autostart installiert: $PLIST_PATH"
echo "Status pruefen: npm run dev:bg:autostart:status"
