#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"
STACK_PID_FILE="$PID_DIR/stack.pid"
STACK_LOG_FILE="$LOG_DIR/stack.log"

mkdir -p "$LOG_DIR" "$PID_DIR"

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

assert_ports_free() {
  local blocked=0
  for p in 3001 5173 8000; do
    local pids
    pids="$(lsof -ti tcp:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      blocked=1
      echo "Port $p is already in use by pid(s): $pids"
      lsof -nP -iTCP:"$p" -sTCP:LISTEN || true
    fi
  done

  if [[ "$blocked" -eq 1 ]]; then
    echo ""
    echo "Cannot start managed stack while ports are occupied."
    echo "Run: npm run dev:bg:stop"
    echo "If still blocked, inspect with: npm run dev:bg:status"
    return 1
  fi
}

echo "Preparing clean background start..."
bash "$ROOT/scripts/dev-bg-stop.sh" >/dev/null || true
assert_ports_free

: > "$STACK_LOG_FILE"
NODE_BIN="${FLIDER_NODE_BIN:-node}"
if [[ "${FLIDER_ELECTRON_RUN_AS_NODE:-}" == "1" ]]; then
  export ELECTRON_RUN_AS_NODE=1
fi
"$NODE_BIN" "$ROOT/scripts/dev-bg-spawn.mjs" >/dev/null

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
