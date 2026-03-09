#!/usr/bin/env bash
set -euo pipefail

AGENT_ID="ch.flatsite.devstack"
PLIST_PATH="$HOME/Library/LaunchAgents/${AGENT_ID}.plist"

launchctl bootout "gui/$(id -u)/${AGENT_ID}" >/dev/null 2>&1 || true

if [[ -f "$PLIST_PATH" ]]; then
  rm -f "$PLIST_PATH"
fi

echo "Autostart entfernt."
echo "Status pruefen: npm run dev:bg:autostart:status"
