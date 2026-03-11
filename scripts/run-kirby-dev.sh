#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIRBY_ROOT="${FLIDER_KIRBY_ROOT:-$ROOT/kirby-cms}"
KIRBY_TEMPLATE_ROOT="$ROOT/kirby-cms"
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

mkdir -p "$KIRBY_ROOT"

# Self-heal for packaged runtime: if core files are missing, restore from template.
if [[ ! -f "$KIRBY_ROOT/kirby/router.php" || ! -f "$KIRBY_ROOT/kirby/bootstrap.php" || ! -f "$KIRBY_ROOT/index.php" ]]; then
  if [[ -d "$KIRBY_TEMPLATE_ROOT/kirby" ]]; then
    mkdir -p "$KIRBY_ROOT/kirby"
    cp -R "$KIRBY_TEMPLATE_ROOT/kirby/." "$KIRBY_ROOT/kirby/"
  fi
  if [[ -f "$KIRBY_TEMPLATE_ROOT/index.php" ]]; then
    cp "$KIRBY_TEMPLATE_ROOT/index.php" "$KIRBY_ROOT/index.php"
  fi
  if [[ -d "$KIRBY_TEMPLATE_ROOT/site/config" ]]; then
    mkdir -p "$KIRBY_ROOT/site/config"
    cp -R "$KIRBY_TEMPLATE_ROOT/site/config/." "$KIRBY_ROOT/site/config/"
  fi
fi

ROUTER_PATH="$KIRBY_ROOT/kirby/router.php"
if [[ ! -f "$ROUTER_PATH" ]]; then
  echo "Kirby Router fehlt: $ROUTER_PATH" >&2
  exit 1
fi

exec "$PHP_BIN" -d "memory_limit=${PHP_MEMORY_LIMIT}" -S 127.0.0.1:8000 -t "$KIRBY_ROOT" "$ROUTER_PATH"
