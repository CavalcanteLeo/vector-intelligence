#!/bin/sh
# Overlay the orthographic preview on the reference for proportion checks.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
P="$ROOT/assets/mascot/previews"
magick "$ROOT/public/assets/images/vector-intelligence-mascote-cutout.png" -resize 627x627 \
  -background white -flatten "$P/ref.png"
magick "$P/ref.png" \( "$P/match.png" -channel A -evaluate multiply 0.55 +channel \) -composite "$P/overlay.png"
magick "$P/ref.png" "$P/match.png" -background white -flatten +append "$P/side-by-side.png" 2>/dev/null || \
  magick "$P/ref.png" \( "$P/match.png" -background white -flatten \) +append "$P/side-by-side.png"
