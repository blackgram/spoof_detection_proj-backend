#!/usr/bin/env bash
# Vendors Silent-Face-Anti-Spoofing from a pinned GitHub tarball (SHA-256 verified).
# Run from anywhere:  bash liveliness-backend/scripts/vendor-silent-face.sh
set -euo pipefail

COMMIT="b6d5f04ad78778917853b25c778acef6d5626d15"
EXPECTED_SHA256="3a5ba6ce4d6f6dbbeb28f5b362d45d5cfbae93eff3889f0d5f1a38297ccd42a2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
THIRD="$LB_ROOT/third_party"
TARGET="$THIRD/Silent-Face-Anti-Spoofing"
URL="https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/archive/${COMMIT}.tar.gz"
ARCHIVE="$(mktemp /tmp/silent-face-XXXXXX.tar.gz)"

cleanup() { rm -f "$ARCHIVE"; }
trap cleanup EXIT

echo "Downloading Silent-Face-Anti-Spoofing @ ${COMMIT}..."
curl -fsSL -o "$ARCHIVE" "$URL"

echo "Verifying SHA-256..."
ACTUAL="$(openssl dgst -sha256 "$ARCHIVE" | awk '{print $2}')"
if [[ "$ACTUAL" != "$EXPECTED_SHA256" ]]; then
  echo "Checksum mismatch." >&2
  echo "  expected: ${EXPECTED_SHA256}" >&2
  echo "  actual:   ${ACTUAL}" >&2
  exit 1
fi

rm -rf "$TARGET"
mkdir -p "$THIRD"
tar -xzf "$ARCHIVE" -C "$THIRD"
mv "$THIRD/Silent-Face-Anti-Spoofing-${COMMIT}" "$TARGET"

echo "Vendored to: ${TARGET}"
echo "Add pretrained weights per upstream README (resources/detection_model, resources/anti_spoof_models)."
