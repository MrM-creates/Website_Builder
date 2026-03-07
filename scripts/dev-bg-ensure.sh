#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

is_ok() {
  local url="$1"
  local accepted="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  code="${code:0:3}"
  [[ " $accepted " == *" $code "* ]]
}

backend_ok=0
frontend_ok=0
kirby_ok=0

is_ok "http://127.0.0.1:3001/api/project-signature" "200" && backend_ok=1
is_ok "http://127.0.0.1:5173/" "200" && frontend_ok=1
is_ok "http://127.0.0.1:8000/" "200 302" && kirby_ok=1

if [[ "$backend_ok" -eq 1 && "$frontend_ok" -eq 1 && "$kirby_ok" -eq 1 ]]; then
  echo "All services already healthy."
  exit 0
fi

echo "Detected unhealthy stack -> restarting background stack..."
bash "$ROOT/scripts/dev-bg-stop.sh"
bash "$ROOT/scripts/dev-bg-start.sh"
