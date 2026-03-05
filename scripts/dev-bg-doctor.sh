#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT/scripts/dev-bg-status.sh"

echo ""
echo "Doctor hint:"
echo "- If one service is down: npm run dev:bg"
echo "- If ports are blocked:   npm run dev:bg:stop && npm run dev:bg"
