#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_SVG="$ROOT/public/brand/flider_app_icon.svg"
FAVICON_SRC="$ROOT/public/brand/flider_icon_dark.svg"
FAVICON_SVG="$ROOT/public/favicon.svg"
OUT_DIR="$ROOT/build-resources/brand"
TMP_DIR="$ROOT/.runtime/tmp/brand-icons"
ICONSET_DIR="$OUT_DIR/flider.iconset"
PNG_1024="$OUT_DIR/flider-1024.png"
ICNS_OUT="$OUT_DIR/flider.icns"
ICO_OUT="$OUT_DIR/flider.ico"

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Fehlt: $cmd"
    exit 1
  fi
}

need_cmd qlmanage
need_cmd sips
need_cmd iconutil
need_cmd python3

if [[ ! -f "$SRC_SVG" ]]; then
  echo "Icon-SVG nicht gefunden: $SRC_SVG"
  exit 1
fi

if [[ ! -f "$FAVICON_SRC" ]]; then
  echo "Favicon-SVG nicht gefunden: $FAVICON_SRC"
  exit 1
fi

mkdir -p "$OUT_DIR" "$TMP_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

cp "$FAVICON_SRC" "$FAVICON_SVG"

qlmanage -t -s 1024 -o "$TMP_DIR" "$SRC_SVG" >/dev/null 2>&1 || {
  echo "SVG->PNG Rendering via qlmanage fehlgeschlagen."
  exit 1
}

RENDERED_PNG="$TMP_DIR/$(basename "$SRC_SVG").png"
if [[ ! -f "$RENDERED_PNG" ]]; then
  echo "Gerendertes PNG nicht gefunden: $RENDERED_PNG"
  exit 1
fi

cp "$RENDERED_PNG" "$PNG_1024"

make_png() {
  local size="$1"
  local out="$2"
  sips -z "$size" "$size" "$PNG_1024" --out "$out" >/dev/null 2>&1
}

make_png 16 "$ICONSET_DIR/icon_16x16.png"
make_png 32 "$ICONSET_DIR/icon_16x16@2x.png"
make_png 32 "$ICONSET_DIR/icon_32x32.png"
make_png 64 "$ICONSET_DIR/icon_32x32@2x.png"
make_png 128 "$ICONSET_DIR/icon_128x128.png"
make_png 256 "$ICONSET_DIR/icon_128x128@2x.png"
make_png 256 "$ICONSET_DIR/icon_256x256.png"
make_png 512 "$ICONSET_DIR/icon_256x256@2x.png"
make_png 512 "$ICONSET_DIR/icon_512x512.png"
make_png 1024 "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_OUT"

python3 - "$PNG_1024" "$ICO_OUT" <<'PY'
import sys
from PIL import Image

src = sys.argv[1]
dst = sys.argv[2]
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img = Image.open(src).convert("RGBA")
img.save(dst, format="ICO", sizes=sizes)
PY

# Optional helper PNG for web assets
sips -z 180 180 "$PNG_1024" --out "$OUT_DIR/apple-touch-icon.png" >/dev/null 2>&1 || true

echo "Brand-Icons erzeugt:"
echo "- favicon: $FAVICON_SVG"
echo "- png 1024: $PNG_1024"
echo "- icns: $ICNS_OUT"
echo "- ico: $ICO_OUT"
