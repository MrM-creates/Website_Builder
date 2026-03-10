#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIRBY_ROOT="${FLIDER_KIRBY_ROOT:-$ROOT/kirby-cms}"
PHP_MEMORY_LIMIT="${PHP_MEMORY_LIMIT:-1024M}"

pick_php_bin() {
  if command -v php >/dev/null 2>&1; then
    command -v php
    return 0
  fi
  if [[ -x "/opt/homebrew/bin/php" ]]; then
    echo "/opt/homebrew/bin/php"
    return 0
  fi
  if [[ -x "/usr/bin/php" ]]; then
    echo "/usr/bin/php"
    return 0
  fi
  return 1
}

PHP_BIN="$(pick_php_bin || true)"
if [[ -z "${PHP_BIN:-}" ]]; then
  echo "PHP wurde nicht gefunden. Bitte PHP installieren oder PATH setzen." >&2
  exit 1
fi

cd "$KIRBY_ROOT"
exec "$PHP_BIN" -d "memory_limit=${PHP_MEMORY_LIMIT}" -S 127.0.0.1:8000 kirby/router.php
