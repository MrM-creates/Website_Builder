#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.runtime/pids"
STACK_PID_FILE="$PID_DIR/stack.pid"

stop_stack_pid() {
  if [[ -f "$STACK_PID_FILE" ]]; then
    local pid
    pid="$(cat "$STACK_PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$STACK_PID_FILE"
  fi
}

stop_stack_pid

for p in 3001 5173 8000; do
  pids="$(lsof -ti tcp:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 0.3
    pids="$(lsof -ti tcp:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    [[ -n "$pids" ]] && echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done

echo "Background dev stack stopped."
