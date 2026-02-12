# Quick Setup Guide for macOS

## ✅ Virtual Environment Created!

## Next Steps

### 1. Activate the virtual environment:

```bash
cd backend
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### 2. Install dependencies:

```bash
pip install -r requirements.txt
```

**Note**: This will take a few minutes as it installs:
- FastAPI and dependencies
- DeepFace (face recognition)
- OpenCV (image processing)
- NumPy and other ML libraries

### 3. Run the server:

```bash
# Option 1: Using the run script
python run.py

# Option 2: Using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Option 3: Using Python module
python -m app.main
```

The API will be available at: **http://localhost:8000**

### 4. Test the API:

Open your browser and visit:
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Important Notes

- On macOS, use `python3` instead of `python` if the command isn't found
- The virtual environment is created in `backend/venv/`
- DeepFace will download models (~500MB) on first use (one-time)

## Troubleshooting

### If `python` command not found:
Use `python3` instead:
```bash
python3 -m venv venv
python3 run.py
```

### If you see import errors:
Make sure you activated the virtual environment:
```bash
source venv/bin/activate
```

### To deactivate virtual environment:
```bash
deactivate
```

