#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.runtime/pids"
STACK_PID_FILE="$PID_DIR/stack.pid"
SERVICE_PORTS=(3001 5173 8000)
STACK_ORCHESTRATOR_PATTERNS=(
  "npm run dev:stack"
  "concurrently --restart-tries 10 --restart-after 1500 -n backend,frontend,kirby"
)

wait_for_pid_exit() {
  local pid="$1"
  local attempts="${2:-30}"
  local delay_s="${3:-0.2}"
  local i=0
  while (( i < attempts )); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep "$delay_s"
    ((i+=1))
  done
  return 1
}

get_pgid() {
  local pid="$1"
  local pgid=""
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  if [[ -n "$pgid" ]]; then
    echo "$pgid"
  fi
}

terminate_pid_group() {
  local signal="${1:-TERM}"
  local pid="${2:-}"
  local pgid
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  pgid="$(get_pgid "$pid")"
  if [[ -n "$pgid" ]]; then
    kill "-$signal" -- "-$pgid" 2>/dev/null || true
  fi
  kill "-$signal" "$pid" 2>/dev/null || true
}

stop_stack_supervisor() {
  if [[ -f "$STACK_PID_FILE" ]]; then
    local pid
    pid="$(cat "$STACK_PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      terminate_pid_group INT "$pid"
      wait_for_pid_exit "$pid" 30 0.2 || true
      if kill -0 "$pid" 2>/dev/null; then
        terminate_pid_group TERM "$pid"
        wait_for_pid_exit "$pid" 20 0.2 || true
      fi
    fi
    if [[ -z "${pid:-}" ]] || ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$STACK_PID_FILE"
    fi
  fi
}

stop_orphan_stack_orchestrators() {
  local pattern
  for pattern in "${STACK_ORCHESTRATOR_PATTERNS[@]}"; do
    pkill -INT -f "$pattern" 2>/dev/null || true
    pkill -TERM -f "$pattern" 2>/dev/null || true
  done
}

drain_service_ports() {
  local attempts="${1:-120}"
  local delay_s="${2:-0.2}"
  local i=0
  local quiet_rounds=0

  while (( i < attempts )); do
    # Keep terminating potential parent orchestrators so they cannot respawn services.
    stop_orphan_stack_orchestrators

    local seen_pids=""
    local port
    for port in "${SERVICE_PORTS[@]}"; do
      local pids
      pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      if [[ -n "$pids" ]]; then
        seen_pids="${seen_pids}"$'\n'"${pids}"
      fi
    done

    if [[ -z "$seen_pids" ]]; then
      quiet_rounds=$((quiet_rounds + 1))
      if (( quiet_rounds >= 10 )); then
        return 0
      fi
      sleep "$delay_s"
      ((i+=1))
      continue
    fi

    quiet_rounds=0
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      terminate_pid_group TERM "$pid"
    done < <(echo "$seen_pids" | sort -u)
    sleep "$delay_s"
    ((i+=1))
  done

  return 1
}

ports_still_up=0

stop_stack_supervisor
stop_orphan_stack_orchestrators
drain_service_ports || true

if [[ -f "$STACK_PID_FILE" ]]; then
  pid="$(cat "$STACK_PID_FILE" 2>/dev/null || true)"
  if [[ -z "${pid:-}" ]] || ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$STACK_PID_FILE"
  fi
fi

for p in "${SERVICE_PORTS[@]}"; do
  pids="$(lsof -ti tcp:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    ports_still_up=1
    echo "Warning: port $p still listening (pid(s): $pids)"
  fi
done

if [[ "$ports_still_up" -eq 1 ]]; then
  echo "Background dev stack stop requested, but some ports are still occupied."
  echo "Run: npm run dev:bg:status"
else
  echo "Background dev stack stopped."
fi
