# Face Verification & Spoof Detection API

FastAPI backend for face verification (1:1 matching) and anti-spoofing detection.

## Features

- 🔍 **Face Verification**: Compare two face images (1:1 matching) using DeepFace with ArcFace model
- 🛡️ **Spoof Detection**: Detect printed photos and screen replays using Silent-Face-Anti-Spoofing
- ⚡ **Fast API**: Built with FastAPI for high performance
- 🚀 **Production Ready**: Docker support, health checks, error handling

## Tech Stack

- **FastAPI** - Modern, fast web framework
- **DeepFace** - Face verification (ArcFace model)
- **Silent-Face-Anti-Spoofing** - Spoof detection (optional, needs model files)
- **OpenCV** - Image processing
- **Uvicorn** - ASGI server

## Installation

### Prerequisites

- **Python 3.11 or 3.12** (required - TensorFlow doesn't support Python 3.13+ yet)
- pip

**⚠️ Important**: Python 3.14 is not supported. Use Python 3.11 or 3.12.

### Setup

1. **Clone repository and navigate to backend:**

```bash
cd backend
```

2. **Create virtual environment (use Python 3.11 or 3.12):**

```bash
# Use Python 3.12 (recommended) or 3.11
python3.12 -m venv venv  # OR python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

**Note**: If `python3.12` is not found, install it with Homebrew: `brew install python@3.12`

3. **Install dependencies:**

```bash
pip install -r requirements.txt
```

4. **(Optional) Install Silent-Face-Anti-Spoofing:**

For proper spoof detection, install Silent-Face-Anti-Spoofing:

```bash
# Clone the repository
git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing.git ../Silent-Face-Anti-Spoofing

# Install dependencies (check their requirements.txt)
# Download model files and place them in models/anti_spoof_models/
```

**Note**: The service will work without Silent-Face-Anti-Spoofing but will use basic detection (placeholder). For production, install it properly.

## Running

### Development

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or:

```bash
python -m app.main
```

API will be available at: http://localhost:8000

### Production

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker

```bash
# Build image
docker build -t face-verification-api .

# Run container
docker run -p 8000:8000 face-verification-api
```

## API Endpoints

### `GET /`

Root endpoint - returns API information.

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "face_verification": "ready",
  "spoof_detection": "ready"
}
```

### `POST /api/verify`

Combined verification endpoint (spoof detection + face verification).

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `id_image`: File (ID/reference photo)
  - `selfie_image`: File (selfie/query photo)

**Response:**
```json
{
  "liveness_check": {
    "is_real": true,
    "confidence": 0.95
  },
  "face_verification": {
    "verified": true,
    "confidence": 0.92,
    "distance": 0.35
  },
  "overall_result": "pass",
  "message": "Identity verified successfully. Face matches and liveness check passed."
}
```

### `POST /api/spoof-check`

Spoof detection only endpoint.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `image`: File (image to check)

**Response:**
```json
{
  "is_real": true,
  "confidence": 0.95,
  "message": "Real"
}
```

### `POST /api/face-verify`

Face verification only endpoint (1:1 matching).

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `image1`: File (reference image)
  - `image2`: File (query image)

**Response:**
```json
{
  "verified": true,
  "confidence": 0.92,
  "distance": 0.35,
  "message": "Faces match"
}
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Configuration

### Environment Variables

- `PORT`: Server port (default: 8000)
- `LOG_LEVEL`: Logging level (default: INFO)

### Model Configuration

- **Face Verification**: Uses DeepFace with ArcFace model (downloaded automatically on first use)
- **Spoof Detection**: Requires Silent-Face-Anti-Spoofing model files in `models/anti_spoof_models/`

## Development

### Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── models/
│   │   ├── __init__.py
│   │   └── response.py      # Pydantic models
│   └── services/
│       ├── __init__.py
│       ├── face_verification.py  # Face verification service
│       └── spoof_detection.py    # Spoof detection service
├── requirements.txt
├── Dockerfile
└── README.md
```

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## Deployment

### Railway.app

1. Connect your GitHub repository
2. Railway will auto-detect Python
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Render.com

1. Connect GitHub repository
2. Create new Web Service
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Docker

Build and push to container registry, then deploy to any platform supporting Docker.

## Troubleshooting

### DeepFace Model Download

DeepFace will download models automatically on first use (~500MB). Ensure you have internet access on first run.

### Silent-Face-Anti-Spoofing Not Working

1. Clone the repository: `git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing.git`
2. Download model files from their releases
3. Place models in `models/anti_spoof_models/`
4. Update import paths in `spoof_detection.py` if needed

### Face Not Detected

- Ensure images contain clear, front-facing faces
- Try different images
- Check image quality and resolution

## License

MIT

## Credits

- **DeepFace**: https://github.com/serengil/deepface
- **Silent-Face-Anti-Spoofing**: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing

