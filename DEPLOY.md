# Deploying to Render

This project deploys **backend/** + **Silent-Face-Anti-Spoofing/** together as one Docker service.

## Quick Deploy

1. Push the repo to GitHub
2. Go to [Render](https://render.com) → New → Web Service
3. Connect your repo
4. Render will detect `render.yaml` (Blueprint) or configure manually:
   - **Root Directory**: leave empty (uses repo root)
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.`
5. Add env var: `SILENT_FACE_PATH` = `/app/Silent-Face-Anti-Spoofing`
6. Choose **Starter** plan or higher (512MB+ RAM for ML models)
7. Deploy

## What Gets Deployed

- **backend/app** – FastAPI app (face verification, spoof detection)
- **Silent-Face-Anti-Spoofing/src** – Anti-spoof code
- **Silent-Face-Anti-Spoofing/resources** – Models (`.pth`, `deploy.prototxt`, `Widerface-RetinaFace.caffemodel`)
- **DeepFace** – Downloads models on first request (~500MB, may slow first call)

## After Deploy

1. Get your URL: `https://spoof-detection-api.onrender.com`
2. Update mobile/frontend:  
   `EXPO_PUBLIC_API_URL=https://spoof-detection-api.onrender.com`
3. Test: `GET /health` → `{"status": "healthy"}`

## Local Docker Test

```bash
# From project root
docker build -f Dockerfile -t spoof-api .
docker run -p 8000:8000 spoof-api
# Visit http://localhost:8000/docs
```
