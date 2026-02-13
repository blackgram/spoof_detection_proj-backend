from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import uvicorn
import logging
import time
import socket

from app.models.response import VerificationResponse


def _get_local_ip():
    """Get this machine's LAN IP for mobile connectivity."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "?"


@asynccontextmanager
async def lifespan(app: FastAPI):
    ip = _get_local_ip()
    logger.info(f"Server ready. For physical device: EXPO_PUBLIC_API_URL=http://{ip}:8000")
    yield

# Configure logging with timestamp and level
import sys
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Face Verification & Spoof Detection API",
    description="API for face verification (1:1 matching) and anti-spoofing detection",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Log every request with method, path, client, duration, and status."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        method, path = request.method, request.url.path
        client = request.client.host if request.client else "unknown"
        logger.info(f"→ {method} {path} [client={client}]")
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(f"← {method} {path} {response.status_code} ({duration_ms:.0f}ms)")
        return response


app.add_middleware(RequestLogMiddleware)

# Lazy-loaded services (TensorFlow/PyTorch load on first request, not at startup)
# This lets the container bind to PORT quickly for Cloud Run
_face_verification_service = None
_spoof_detection_service = None


def get_face_verification_service():
    global _face_verification_service
    if _face_verification_service is None:
        from app.services.face_verification import FaceVerificationService
        _face_verification_service = FaceVerificationService()
    return _face_verification_service


def get_spoof_detection_service():
    global _spoof_detection_service
    if _spoof_detection_service is None:
        from app.services.spoof_detection import SpoofDetectionService
        _spoof_detection_service = SpoofDetectionService()
    return _spoof_detection_service


@app.get("/")
async def root():
    return {
        "message": "Face Verification & Spoof Detection API",
        "version": "1.0.0",
        "status": "running"
    }


@app.post("/api/warmup")
async def warmup_models():
    """
    Pre-load ML models (TensorFlow, PyTorch, DeepFace, Silent-Face).
    Call this when the user opens the verification flow so /api/verify is fast.
    Takes 2-4 minutes on first call; subsequent calls return immediately.
    """
    start = time.perf_counter()
    logger.info("Warmup started: loading ML models...")
    try:
        t0 = time.perf_counter()
        get_face_verification_service()
        logger.info(f"Face verification service loaded ({time.perf_counter() - t0:.1f}s)")
        t0 = time.perf_counter()
        get_spoof_detection_service()
        logger.info(f"Spoof detection service loaded ({time.perf_counter() - t0:.1f}s)")
        elapsed = time.perf_counter() - start
        logger.info(f"Warmup complete (total {elapsed:.1f}s)")
        return {"status": "ready", "message": "Models loaded", "elapsed_sec": round(elapsed, 1)}
    except Exception as e:
        logger.error(f"Warmup failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check if services are initialized
        return {
            "status": "healthy",
            "face_verification": "ready",
            "spoof_detection": "ready"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


@app.post("/api/verify", response_model=VerificationResponse)
async def verify_identity(
    id_image: UploadFile = File(..., description="ID photo or reference image"),
    selfie_image: UploadFile = File(..., description="Selfie or query image")
):
    """
    Combined verification endpoint:
    1. Check if selfie is real (spoof detection)
    2. If real, verify face match (face verification)
    """
    try:
        # Validate file types
        if not id_image.content_type or not id_image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="ID image must be an image file")
        
        if not selfie_image.content_type or not selfie_image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Selfie image must be an image file")

        verify_start = time.perf_counter()
        logger.info("Starting verification process...")

        # Step 1: Spoof Detection (check if selfie is real)
        logger.info("=" * 80)
        logger.info("STEP 1: SPOOF DETECTION (Liveness Check)")
        logger.info("=" * 80)
        
        await selfie_image.seek(0)
        selfie_bytes = await selfie_image.read()
        
        if not selfie_bytes or len(selfie_bytes) == 0:
            raise HTTPException(status_code=400, detail="Selfie image is empty or could not be read")
        
        logger.info(f"Selfie image received: {len(selfie_bytes)} bytes, content_type: {selfie_image.content_type}")
        
        t0 = time.perf_counter()
        spoof_result = await get_spoof_detection_service().detect_spoof(selfie_bytes)
        logger.info(f"Spoof detection done ({time.perf_counter() - t0:.1f}s)")
        
        logger.info(f"Spoof detection result: is_real={spoof_result['is_real']}, confidence={spoof_result['confidence']:.2%}")
        if 'details' in spoof_result:
            logger.info(f"Detection details: {spoof_result['details']}")

        if not spoof_result["is_real"]:
            logger.warning("=" * 80)
            logger.warning("❌ SPOOF DETECTED - Verification stopped")
            logger.warning(f"Reason: {spoof_result.get('reason', 'Unknown')}")
            logger.warning("=" * 80)
            return VerificationResponse(
                liveness_check={
                    "is_real": False,
                    "confidence": spoof_result["confidence"]
                },
                face_verification={
                    "verified": False,
                    "confidence": 0.0,
                    "distance": 1.0
                },
                overall_result="spoof_detected",
                message=f"Spoof detected. {spoof_result.get('reason', 'The selfie appears to be fake (printed photo or screen replay).')}"
            )

        # Step 2: Face Verification (if selfie is real)
        logger.info("=" * 80)
        logger.info("✅ STEP 2: FACE VERIFICATION (Liveness check passed)")
        logger.info("=" * 80)
        
        # Read ID image bytes (reset file pointer first)
        await id_image.seek(0)
        id_bytes = await id_image.read()
        
        if not id_bytes or len(id_bytes) == 0:
            raise HTTPException(status_code=400, detail="ID image is empty or could not be read")
        
        logger.info(f"ID image received: {len(id_bytes)} bytes, content_type: {id_image.content_type}")
        
        t0 = time.perf_counter()
        verification_result = await get_face_verification_service().verify_faces(
            id_bytes, 
            selfie_bytes
        )
        logger.info(f"Face verification done ({time.perf_counter() - t0:.1f}s)")
        
        logger.info(f"Face verification result: verified={verification_result['verified']}, "
                   f"confidence={verification_result['confidence']:.2%}, "
                   f"distance={verification_result['distance']:.4f}")

        # Determine overall result
        if verification_result["verified"]:
            overall_result = "pass"
            message = "Identity verified successfully. Face matches and liveness check passed."
        else:
            overall_result = "fail"
            message = f"Face verification failed. Faces do not match (confidence: {verification_result['confidence']:.2%})."

        total_sec = time.perf_counter() - verify_start
        logger.info("=" * 80)
        logger.info(f"📊 FINAL RESULT: {overall_result.upper()} (total {total_sec:.1f}s)")
        logger.info(f"Message: {message}")
        logger.info("=" * 80)

        return VerificationResponse(
            liveness_check={
                "is_real": True,
                "confidence": spoof_result["confidence"]
            },
            face_verification={
                "verified": verification_result["verified"],
                "confidence": verification_result["confidence"],
                "distance": verification_result["distance"]
            },
            overall_result=overall_result,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Verification failed: {str(e)}"
        )


@app.post("/api/spoof-check")
async def check_spoof(
    image: UploadFile = File(..., description="Image to check for spoofing")
):
    """
    Spoof detection only endpoint
    """
    try:
        if not image.content_type or not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Image must be an image file")

        image_bytes = await image.read()
        t0 = time.perf_counter()
        result = await get_spoof_detection_service().detect_spoof(image_bytes)
        logger.info(f"Spoof check done ({time.perf_counter() - t0:.1f}s) is_real={result['is_real']}")

        return {
            "is_real": result["is_real"],
            "confidence": result["confidence"],
            "message": result.get("reason", "Real" if result["is_real"] else "Spoof detected")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Spoof detection error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Spoof detection failed: {str(e)}"
        )


@app.post("/api/face-verify")
async def verify_faces(
    image1: UploadFile = File(..., description="First image (reference)"),
    image2: UploadFile = File(..., description="Second image (query)")
):
    """
    Face verification only endpoint (1:1 matching)
    """
    try:
        if not image1.content_type or not image1.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="First image must be an image file")
        
        if not image2.content_type or not image2.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Second image must be an image file")

        # Reset file pointers and read bytes
        await image1.seek(0)
        await image2.seek(0)
        image1_bytes = await image1.read()
        image2_bytes = await image2.read()
        
        if not image1_bytes or len(image1_bytes) == 0:
            raise HTTPException(status_code=400, detail="First image is empty or could not be read")
        if not image2_bytes or len(image2_bytes) == 0:
            raise HTTPException(status_code=400, detail="Second image is empty or could not be read")
        
        t0 = time.perf_counter()
        result = await get_face_verification_service().verify_faces(image1_bytes, image2_bytes)
        logger.info(f"Face verify done ({time.perf_counter() - t0:.1f}s) verified={result['verified']}")

        return {
            "verified": result["verified"],
            "confidence": result["confidence"],
            "distance": result["distance"],
            "message": "Faces match" if result["verified"] else "Faces do not match"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face verification error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Face verification failed: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

