#!/bin/sh
# Cloud Run sets PORT=8080; other platforms may use 8000
PORT=${PORT:-8080}
echo "Starting on port $PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
