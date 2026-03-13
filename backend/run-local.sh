#!/bin/sh
# Run backend for local Expo testing. Use PYTHONUNBUFFERED so logs appear immediately.
# Optional: copy .env.example to .env and set FIRESTORE_PROJECT_ID for persistence.
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
export PYTHONPATH=.
export SILENT_FACE_PATH="${SILENT_FACE_PATH:-../Silent-Face-Anti-Spoofing}"

# Load .env and export so Python/uvicorn see them (required for Firestore)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
  export FIRESTORE_PROJECT_ID
  export GOOGLE_APPLICATION_CREDENTIALS
fi

# Prefer .venv then venv; fall back to python3. Use 1 worker so in-memory store is consistent (or set FIRESTORE_PROJECT_ID for persistence).
if [ -x ./.venv/bin/python ]; then
  exec ./.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
elif [ -x ./venv/bin/python ]; then
  exec ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
else
  exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
fi
