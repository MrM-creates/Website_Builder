#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"
STACK_PID_FILE="$PID_DIR/stack.pid"
STACK_LOG_FILE="$LOG_DIR/stack.log"

mkdir -p "$LOG_DIR" "$PID_DIR"

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

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 0.5
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

http_code() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  if [[ -z "$code" || "$code" == "000000" ]]; then
    code="000"
  fi
  echo "${code:0:3}"
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local accepted="$3"
  local attempts="${4:-80}"
  local sleep_s="${5:-0.25}"

  local i=0
  while (( i < attempts )); do
    local code
    code="$(http_code "$url")"
    if [[ " $accepted " == *" $code "* ]]; then
      echo "OK   $name ($url) -> $code"
      return 0
    fi
    sleep "$sleep_s"
    ((i+=1))
  done

  local final_code
  final_code="$(http_code "$url")"
  echo "FAIL $name ($url) -> $final_code"
  return 1
}

echo "Preparing clean background start..."
stop_stack_pid
for p in 3001 5173 8000; do free_port "$p"; done

: > "$STACK_LOG_FILE"
node "$ROOT/scripts/dev-bg-spawn.mjs" >/dev/null

echo "Waiting for services..."
all_ok=1
wait_for_http "backend" "http://127.0.0.1:3001/api/project-signature" "200" || all_ok=0
wait_for_http "frontend" "http://127.0.0.1:5173/" "200" || all_ok=0
wait_for_http "kirby" "http://127.0.0.1:8000/" "200 302" || all_ok=0

echo ""
if [[ "$all_ok" -ne 1 ]]; then
  echo "Warning: one or more services failed initial health checks."
  echo "Check logs if needed:"
  echo "- Logs:   npm run dev:bg:logs"
  echo "- Status: npm run dev:bg:status"
else
  echo "Background dev stack started."
fi

echo "Canonical local start remains: npm run dev"
echo "- Status: npm run dev:bg:status"
echo "- Logs:   npm run dev:bg:logs"
echo "- Stop:   npm run dev:bg:stop"
