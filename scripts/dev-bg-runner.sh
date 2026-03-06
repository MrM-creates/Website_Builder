#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 4 ]]; then
  echo "usage: dev-bg-runner.sh <name> <log_file> <workdir> <command...>" >&2
  exit 2
fi

name="$1"
log_file="$2"
workdir="$3"
shift 3

mkdir -p "$(dirname "$log_file")"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

while true; do
  echo "[$(timestamp)] starting $name" >> "$log_file"

  set +e
  (
    cd "$workdir"
    "$@"
  ) >> "$log_file" 2>&1
  code=$?
  set -e

  echo "[$(timestamp)] $name exited with $code, restarting in 1s" >> "$log_file"
  sleep 1
done
