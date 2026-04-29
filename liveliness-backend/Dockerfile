FROM python:3.11-slim

# Build: docker build -t liveliness-backend .
# Run (API listens on 8001; map it to the host):
#   docker run --rm -p 8001:8001 -e ACCESS_BANK_EFM_AUTH_TOKEN=... liveliness-backend
# If Access Bank fails with [Errno -2] Name or service not known, Docker can't resolve DNS:
#   docker run ... --dns 8.8.8.8 --dns 8.8.4.4 ...
# Or set ACCESS_BANK_EFM_URL to a reachable host (VPN/corp network may block from container).
# Health: http://127.0.0.1:8001/health   |  Test UI: http://127.0.0.1:8001/test-ui
#
# The CMD below starts uvicorn when the container runs — `docker build` does not keep the server running.

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Vendored Silent-Face upstream (populate with scripts/vendor-silent-face.sh before build — pinned tarball + checksum).
COPY third_party/Silent-Face-Anti-Spoofing /app/Silent-Face-Anti-Spoofing

COPY requirements-docker.txt .
# CPU-only PyTorch: avoids large NVIDIA/NCCL libs (smaller layers; fixes many "exporting to image" I/O errors).
RUN pip install --no-cache-dir -r requirements-docker.txt \
    && pip install --no-cache-dir "torch>=2.0.0" "torchvision>=0.15.0" \
        --index-url https://download.pytorch.org/whl/cpu

COPY app/ ./app/
COPY static/ ./static/

EXPOSE 8001

# Mark container healthy once HTTP /health returns 200 (shows in `docker ps`).
HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=8)"

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV SILENT_FACE_PATH=/app/Silent-Face-Anti-Spoofing

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
