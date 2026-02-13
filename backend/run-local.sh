#!/bin/sh
# Run backend for local Expo testing. Use PYTHONUNBUFFERED so logs appear immediately.
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
export PYTHONPATH=.
export SILENT_FACE_PATH="../Silent-Face-Anti-Spoofing"
exec ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
