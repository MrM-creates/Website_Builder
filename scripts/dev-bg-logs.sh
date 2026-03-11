#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ROOT="${FLIDER_RUNTIME_ROOT:-$ROOT}"
LOG_FILE="$RUNTIME_ROOT/.runtime/logs/stack.log"

echo "===== stack.log ====="
if [[ -f "$LOG_FILE" ]]; then
  tail -n 160 "$LOG_FILE"
else
  echo "(no stack log yet)"
fi
