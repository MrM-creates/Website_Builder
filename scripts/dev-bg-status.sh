#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ROOT="${FLIDER_RUNTIME_ROOT:-$ROOT}"
PID_DIR="$RUNTIME_ROOT/.runtime/pids"
STACK_PID_FILE="$PID_DIR/stack.pid"

stack_pid=""
stack_alive=0

if [[ -f "$STACK_PID_FILE" ]]; then
  stack_pid="$(cat "$STACK_PID_FILE" 2>/dev/null || true)"
  if [[ -n "${stack_pid:-}" ]] && kill -0 "$stack_pid" 2>/dev/null; then
    stack_alive=1
  fi
fi

http_code() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  if [[ -z "$code" || "$code" == "000000" ]]; then
    code="000"
  fi
  echo "${code:0:3}"
}

echo "Stack:"
if [[ "$stack_alive" -eq 1 ]]; then
  echo "stack: running (pid $stack_pid)"
elif [[ -f "$STACK_PID_FILE" ]]; then
  echo "stack: stale pid file (${stack_pid:-unknown})"
else
  echo "stack: not running"
fi

echo ""
echo "Ports:"
for p in 3001 5173 8000; do
  pid="$(lsof -ti tcp:"$p" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "$pid" ]]; then
    echo "port $p: listening (pid $pid)"
  else
    echo "port $p: down"
  fi
done

echo ""
echo "HTTP checks:"
echo "backend  : $(http_code http://127.0.0.1:3001/api/project-signature)"
echo "frontend : $(http_code http://127.0.0.1:5173/)"
echo "kirby    : $(http_code http://127.0.0.1:8000/)"
