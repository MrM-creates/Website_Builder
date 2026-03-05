#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.runtime/pids"

print_proc() {
  local name="$1"
  local port="$2"
  local pid_file="$PID_DIR/${name}.pid"
  local port_pid
  port_pid="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"

  if [[ -n "$port_pid" ]]; then
    echo "${name}: running (pid $port_pid, port $port)"
    return
  fi

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    echo "${name}: stale pid file (${pid:-unknown}, port $port down)"
    return
  fi

  echo "${name}: not running (port $port down)"
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

echo "Processes:"
print_proc backend 3001
print_proc frontend 5173
print_proc kirby 8000

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
