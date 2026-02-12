# Deployment Dockerfile - builds backend + Silent-Face-Anti-Spoofing
# Build from project root: docker build -f Dockerfile .

FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV, etc.
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

# Silent-Face-Anti-Spoofing (code + models)
COPY Silent-Face-Anti-Spoofing/src ./Silent-Face-Anti-Spoofing/src
COPY Silent-Face-Anti-Spoofing/resources ./Silent-Face-Anti-Spoofing/resources

# For Silent-Face imports
ENV SILENT_FACE_PATH=/app/Silent-Face-Anti-Spoofing
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
