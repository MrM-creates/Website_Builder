#!/usr/bin/env bash
set -euo pipefail

AGENT_ID="ch.flatsite.devstack"
PLIST_PATH="$HOME/Library/LaunchAgents/${AGENT_ID}.plist"

echo "LaunchAgent:"
if [[ -f "$PLIST_PATH" ]]; then
  echo "plist: present ($PLIST_PATH)"
else
  echo "plist: missing ($PLIST_PATH)"
fi

if launchctl print "gui/$(id -u)/${AGENT_ID}" >/dev/null 2>&1; then
  echo "load: loaded"
  launchctl print "gui/$(id -u)/${AGENT_ID}" 2>/dev/null | rg -n "state =|last exit code =" || true
else
  echo "load: not loaded"
fi
