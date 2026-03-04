#!/bin/zsh
set -euo pipefail
unsetopt BG_NICE

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
START_TIMEOUT_SECONDS=20

mkdir -p "$PID_DIR" "$LOG_DIR"

SERVICES=(backend frontend kirby)

pid_file() {
  echo "$PID_DIR/$1.pid"
}

log_file() {
  echo "$LOG_DIR/$1.log"
}

service_port() {
  case "$1" in
    backend) echo "3001" ;;
    frontend) echo "5173" ;;
    kirby) echo "8000" ;;
    *)
      echo "Unknown service: $1" >&2
      exit 1
      ;;
  esac
}

service_command() {
  case "$1" in
    backend) echo "node server.js" ;;
    frontend) echo "./node_modules/.bin/vite --host 127.0.0.1 --port 5173 --strictPort" ;;
    kirby) echo "cd kirby-cms && /opt/homebrew/bin/php -S 127.0.0.1:8000 kirby/router.php" ;;
    *)
      echo "Unknown service: $1" >&2
      exit 1
      ;;
  esac
}

service_timeout() {
  case "$1" in
    backend) echo "15" ;;
    frontend) echo "20" ;;
    kirby) echo "15" ;;
    *) echo "$START_TIMEOUT_SECONDS" ;;
  esac
}

read_pid() {
  local name="$1"
  local pidfile
  pidfile="$(pid_file "$name")"
  [[ -f "$pidfile" ]] || return 1
  cat "$pidfile"
}

pid_is_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

port_listener_pids() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null || true
}

port_is_listening() {
  local port="$1"
  [[ -n "$(port_listener_pids "$port")" ]]
}

cleanup_stale_pidfile() {
  local name="$1"
  local quiet="${2:-false}"
  local pidfile
  pidfile="$(pid_file "$name")"

  [[ -f "$pidfile" ]] || return 0

  local pid
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  if ! pid_is_alive "$pid"; then
    rm -f "$pidfile"
    if [[ "$quiet" != "true" ]]; then
      echo "removed stale pid file for $name"
    fi
  fi
}

is_running() {
  local name="$1"
  cleanup_stale_pidfile "$name" "true"

  local pid port
  pid="$(read_pid "$name" 2>/dev/null || true)"
  port="$(service_port "$name")"

  pid_is_alive "$pid" && port_is_listening "$port"
}

kill_port_listeners() {
  local port="$1"
  local reason="${2:-}"
  local -a raw pids remaining
  local pid

  raw=("${(@f)$(port_listener_pids "$port")}")
  pids=()
  for pid in "${raw[@]}"; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done

  (( ${#pids[@]} > 0 )) || return 0

  if [[ -n "$reason" ]]; then
    echo "freeing port $port ($reason): ${pids[*]}"
  else
    echo "freeing port $port: ${pids[*]}"
  fi

  for pid in "${pids[@]}"; do
    kill -TERM "$pid" >/dev/null 2>&1 || true
  done
  sleep 0.4

  raw=("${(@f)$(port_listener_pids "$port")}")
  remaining=()
  for pid in "${raw[@]}"; do
    [[ -n "$pid" ]] && remaining+=("$pid")
  done

  if (( ${#remaining[@]} > 0 )); then
    for pid in "${remaining[@]}"; do
      kill -KILL "$pid" >/dev/null 2>&1 || true
    done
    sleep 0.2
  fi

  if port_is_listening "$port"; then
    echo "failed to free port $port; stop conflicting process manually"
    return 1
  fi
}

wait_for_service_ready() {
  local name="$1"
  local timeout="$2"
  local elapsed=0
  local step=0.2

  while (( elapsed < timeout * 10 )); do
    if is_running "$name"; then
      return 0
    fi
    sleep "$step"
    (( elapsed += 2 ))
  done

  return 1
}

show_recent_log() {
  local name="$1"
  local logfile
  logfile="$(log_file "$name")"
  echo "--- recent log: $name ---"
  tail -n 30 "$logfile" 2>/dev/null || true
  echo "--- end log ---"
}

start_service() {
  local name="$1" command port timeout
  local pidfile logfile runner

  command="$(service_command "$name")"
  port="$(service_port "$name")"
  timeout="$(service_timeout "$name")"
  pidfile="$(pid_file "$name")"
  logfile="$(log_file "$name")"
  touch "$logfile"

  if is_running "$name"; then
    echo "$name is already running (pid $(cat "$pidfile"), port $port)"
    return 0
  fi

  if [[ -f "$pidfile" ]]; then
    echo "$name has unhealthy wrapper process, restarting..."
    stop_service "$name" || true
  fi

  kill_port_listeners "$port" "before starting $name"

  runner="cd \"$ROOT_DIR\" && while true; do $command; ec=\$?; echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] $name exited with \$ec, restarting in 1s\"; sleep 1; done"
  nohup /bin/zsh -lc "$runner" >>"$logfile" 2>&1 &
  echo $! >"$pidfile"
  echo "starting $name (pid $(cat "$pidfile"), waiting for port $port)..."

  if ! wait_for_service_ready "$name" "$timeout"; then
    echo "failed to start $name: port $port is not ready after ${timeout}s"
    show_recent_log "$name"
    stop_service "$name" || true
    return 1
  fi

  echo "started $name (pid $(cat "$pidfile"), port $port)"
}

stop_service() {
  local name="$1"
  local port
  local pidfile

  port="$(service_port "$name")"
  pidfile="$(pid_file "$name")"

  if [[ ! -f "$pidfile" ]]; then
    echo "$name wrapper is not running"
  else
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"

    if pid_is_alive "$pid"; then
      pkill -TERM -P "$pid" >/dev/null 2>&1 || true
      kill -TERM "$pid" >/dev/null 2>&1 || true
      sleep 0.4
      if pid_is_alive "$pid"; then
        pkill -KILL -P "$pid" >/dev/null 2>&1 || true
        kill -KILL "$pid" >/dev/null 2>&1 || true
      fi
    fi

    rm -f "$pidfile"
    echo "stopped $name wrapper"
  fi

  if port_is_listening "$port"; then
    kill_port_listeners "$port" "while stopping $name" || true
  fi

  if ! port_is_listening "$port"; then
    echo "$name port $port is down"
  fi
}

print_status() {
  local name="$1"
  local port pid
  local wrapper_up="no"
  local port_up="no"

  cleanup_stale_pidfile "$name" "true"
  port="$(service_port "$name")"
  pid="$(read_pid "$name" 2>/dev/null || true)"

  if pid_is_alive "$pid"; then
    wrapper_up="yes"
  fi
  if port_is_listening "$port"; then
    port_up="yes"
  fi

  if [[ "$wrapper_up" == "yes" && "$port_up" == "yes" ]]; then
    echo "$name: running (pid $pid, port $port)"
  elif [[ "$wrapper_up" == "yes" && "$port_up" == "no" ]]; then
    echo "$name: degraded (wrapper pid $pid alive, port $port down)"
  elif [[ "$wrapper_up" == "no" && "$port_up" == "yes" ]]; then
    echo "$name: stray listener (port $port up without wrapper pid)"
  else
    echo "$name: stopped"
  fi
}

start_all() {
  for service in "${SERVICES[@]}"; do
    start_service "$service"
  done
}

stop_all() {
  for service in "${SERVICES[@]}"; do
    stop_service "$service"
  done
}

status_all() {
  local service port
  for service in "${SERVICES[@]}"; do
    print_status "$service"
  done
  echo "--- ports ---"
  for service in "${SERVICES[@]}"; do
    port="$(service_port "$service")"
    if port_is_listening "$port"; then
      echo "$port: listening"
    else
      echo "$port: down"
    fi
  done
}

doctor_all() {
  local service port

  echo "doctor: cleaning stale pid files..."
  for service in "${SERVICES[@]}"; do
    cleanup_stale_pidfile "$service"
  done

  echo "doctor: stopping wrappers and clearing conflicting listeners..."
  for service in "${SERVICES[@]}"; do
    stop_service "$service" || true
  done
  for service in "${SERVICES[@]}"; do
    port="$(service_port "$service")"
    kill_port_listeners "$port" "doctor cleanup" || true
  done

  echo "doctor: starting clean service set..."
  start_all
  status_all
}

logs_all() {
  local target="${1:-all}"

  case "$target" in
    backend|frontend|kirby)
      tail -n 120 -f "$(log_file "$target")"
      ;;
    all)
      touch "$(log_file backend)" "$(log_file frontend)" "$(log_file kirby)"
      tail -n 80 -f "$(log_file backend)" "$(log_file frontend)" "$(log_file kirby)"
      ;;
    *)
      echo "Unknown service: $target"
      exit 1
      ;;
  esac
}

action="${1:-status}"

case "$action" in
  start)
    start_all
    status_all
    ;;
  stop)
    stop_all
    status_all
    ;;
  restart)
    stop_all
    start_all
    status_all
    ;;
  doctor)
    doctor_all
    ;;
  status)
    status_all
    ;;
  logs)
    logs_all "${2:-all}"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|doctor|status|logs [backend|frontend|kirby|all]}"
    exit 1
    ;;
esac
