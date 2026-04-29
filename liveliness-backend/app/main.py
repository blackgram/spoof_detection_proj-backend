"""Liveliness / spoof + face verification API — deployable standalone (no Firestore)."""

from contextlib import asynccontextmanager
import logging
import socket
import sys
import time
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.models.response import VerificationResponse
from app.routers import liveness


def _get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "?"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ip = _get_local_ip()
    logger.info("Liveliness backend ready (default http://%s:8001). Set SILENT_FACE_PATH if needed.", ip)
    yield


app = FastAPI(
    title="Liveliness — Face Verification & Spoof Detection",
    description=(
        "Stateless spoof/face endpoints plus Access Bank-backed /api/kyc routes "
        "(no Firestore; reference images from AccountImageCollection only)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(liveness.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        method, path = request.method, request.url.path
        client = request.client.host if request.client else "unknown"
        logger.info("→ %s %s [client=%s]", method, path, client)
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info("← %s %s %s (%.0fms)", method, path, response.status_code, duration_ms)
        return response


app.add_middleware(RequestLogMiddleware)

from app.services.loader import get_face_verification_service, get_spoof_detection_service  # noqa: E402


@app.get("/")
async def root():
    return {
        "message": "Liveliness — Face Verification & Spoof Detection",
        "version": "1.0.0",
        "status": "running",
        "test_ui": "/test-ui",
    }


@app.post("/api/warmup")
async def warmup_models():
    """Pre-load ML models (TensorFlow / PyTorch / DeepFace / Silent-Face when installed)."""
    start = time.perf_counter()
    logger.info("Warmup started: loading ML models...")
    try:
        t0 = time.perf_counter()
        get_face_verification_service()
        logger.info("Face verification service loaded (%.1fs)", time.perf_counter() - t0)
        t0 = time.perf_counter()
        get_spoof_detection_service()
        logger.info("Spoof detection service loaded (%.1fs)", time.perf_counter() - t0)
        elapsed = time.perf_counter() - start
        logger.info("Warmup complete (total %.1fs)", elapsed)
        return {"status": "ready", "message": "Models loaded", "elapsed_sec": round(elapsed, 1)}
    except Exception as e:
        logger.error("Warmup failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "face_verification": "ready",
        "spoof_detection": "ready",
    }


@app.post("/api/verify", response_model=VerificationResponse)
async def verify_identity(
    id_image: UploadFile = File(..., description="ID photo or reference image"),
    selfie_image: UploadFile = File(..., description="Selfie or query image"),
):
    """Spoof detection on selfie, then 1:1 face match."""
    try:
        if not id_image.content_type or not id_image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="ID image must be an image file")
        if not selfie_image.content_type or not selfie_image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Selfie image must be an image file")

        verify_start = time.perf_counter()
        logger.info("Starting verification process...")

        await selfie_image.seek(0)
        selfie_bytes = await selfie_image.read()
        if not selfie_bytes:
            raise HTTPException(status_code=400, detail="Selfie image is empty or could not be read")

        t0 = time.perf_counter()
        spoof_result = await get_spoof_detection_service().detect_spoof(selfie_bytes)
        logger.info("Spoof detection done (%.1fs)", time.perf_counter() - t0)

        if not spoof_result["is_real"]:
            return VerificationResponse(
                liveness_check={"is_real": False, "confidence": spoof_result["confidence"]},
                face_verification={"verified": False, "confidence": 0.0, "distance": 1.0},
                overall_result="spoof_detected",
                message=spoof_result.get(
                    "reason",
                    "The selfie appears to be fake (printed photo or screen replay).",
                ),
            )

        await id_image.seek(0)
        id_bytes = await id_image.read()
        if not id_bytes:
            raise HTTPException(status_code=400, detail="ID image is empty or could not be read")

        verification_result = await get_face_verification_service().verify_faces(id_bytes, selfie_bytes)

        if verification_result["verified"]:
            overall_result = "pass"
            message = "Identity verified successfully. Face matches and liveness check passed."
        else:
            overall_result = "fail"
            message = (
                f"Face verification failed. Faces do not match (confidence: {verification_result['confidence']:.2%})."
            )

        return VerificationResponse(
            liveness_check={"is_real": True, "confidence": spoof_result["confidence"]},
            face_verification={
                "verified": verification_result["verified"],
                "confidence": verification_result["confidence"],
                "distance": verification_result["distance"],
            },
            overall_result=overall_result,
            message=message,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Verification error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@app.post("/api/spoof-check")
async def check_spoof(image: UploadFile = File(..., description="Image to check for spoofing")):
    try:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Image must be an image file")
        image_bytes = await image.read()
        result = await get_spoof_detection_service().detect_spoof(image_bytes)
        return {
            "is_real": result["is_real"],
            "confidence": result["confidence"],
            "message": result.get("reason", "Real" if result["is_real"] else "Spoof detected"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Spoof detection error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Spoof detection failed: {str(e)}")


@app.post("/api/face-verify")
async def verify_faces(
    image1: UploadFile = File(..., description="First image (reference)"),
    image2: UploadFile = File(..., description="Second image (query)"),
):
    try:
        if not image1.content_type or not image1.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="First image must be an image file")
        if not image2.content_type or not image2.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Second image must be an image file")

        await image1.seek(0)
        await image2.seek(0)
        image1_bytes = await image1.read()
        image2_bytes = await image2.read()
        if not image1_bytes:
            raise HTTPException(status_code=400, detail="First image is empty or could not be read")
        if not image2_bytes:
            raise HTTPException(status_code=400, detail="Second image is empty or could not be read")

        result = await get_face_verification_service().verify_faces(image1_bytes, image2_bytes)
        return {
            "verified": result["verified"],
            "confidence": result["confidence"],
            "distance": result["distance"],
            "message": "Faces match" if result["verified"] else "Faces do not match",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Face verification error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Face verification failed: {str(e)}")


_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.is_dir():

    @app.get("/test-ui", include_in_schema=False)
    async def test_ui_redirect():
        """Shortcut to `static/index.html` (account + selfie tester)."""
        return RedirectResponse(url="/static/index.html")

    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR), html=True), name="static")
