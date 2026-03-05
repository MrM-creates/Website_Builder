#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

stop_pid_file() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 0.4
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

start_proc() {
  local name="$1"
  local workdir="$2"
  shift 2
  local log_file="$LOG_DIR/${name}.log"
  local pid_file="$PID_DIR/${name}.pid"

  {
    echo "[$(timestamp)] starting $name"
  } >> "$log_file"

  (
    cd "$workdir"
    if command -v setsid >/dev/null 2>&1; then
      setsid "$@" >> "$log_file" 2>&1 < /dev/null &
    else
      nohup "$@" >> "$log_file" 2>&1 < /dev/null &
    fi
    echo $! > "$pid_file"
  )
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
  local attempts="${4:-40}"
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
for n in backend frontend kirby; do stop_pid_file "$n"; done
for p in 3001 5173 8000; do free_port "$p"; done

start_proc backend "$ROOT" node server.js
start_proc frontend "$ROOT" npx vite --host 127.0.0.1 --strictPort
start_proc kirby "$ROOT/kirby-cms" /opt/homebrew/bin/php -S 127.0.0.1:8000 kirby/router.php

echo "Waiting for services..."
all_ok=1
wait_for_http "backend" "http://127.0.0.1:3001/api/project-signature" "200" || all_ok=0
wait_for_http "frontend" "http://127.0.0.1:5173/" "200" || all_ok=0
wait_for_http "kirby" "http://127.0.0.1:8000/" "200 302" || all_ok=0

backend_pid="$(lsof -ti tcp:3001 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
frontend_pid="$(lsof -ti tcp:5173 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
kirby_pid="$(lsof -ti tcp:8000 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -n "$backend_pid" ]] && echo "$backend_pid" > "$PID_DIR/backend.pid"
[[ -n "$frontend_pid" ]] && echo "$frontend_pid" > "$PID_DIR/frontend.pid"
[[ -n "$kirby_pid" ]] && echo "$kirby_pid" > "$PID_DIR/kirby.pid"

echo ""
if [[ "$all_ok" -ne 1 ]]; then
  echo "Background dev stack failed health checks."
  echo "Run: npm run dev:bg:logs"
  exit 1
fi

echo "Background dev stack started."
echo "- Status: npm run dev:bg:status"
echo "- Logs:   npm run dev:bg:logs"
echo "- Stop:   npm run dev:bg:stop"
