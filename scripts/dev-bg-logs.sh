#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.runtime/logs"

mkdir -p "$LOG_DIR"

for name in backend frontend kirby; do
  file="$LOG_DIR/${name}.log"
  echo "===== ${name}.log ====="
  if [[ -f "$file" ]]; then
    tail -n 80 "$file"
  else
    echo "(no log file yet)"
  fi
  echo ""
done
