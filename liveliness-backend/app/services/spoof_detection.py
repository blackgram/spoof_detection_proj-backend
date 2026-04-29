import cv2
import logging
import os
import sys
import traceback
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Silent-Face repo root (not src) added to path for "from src.xxx"
SILENT_FACE_REPO_PATH = None
SILENT_FACE_AVAILABLE = False


def _get_silent_face_paths():
    paths = []
    env_path = os.environ.get("SILENT_FACE_PATH")
    if env_path:
        paths.append(env_path)
    paths.extend([
        os.path.join(os.path.dirname(__file__), "../../third_party/Silent-Face-Anti-Spoofing"),
        os.path.join(os.path.dirname(__file__), "../../Silent-Face-Anti-Spoofing"),
        os.path.join(os.path.dirname(__file__), "../../../Silent-Face-Anti-Spoofing"),
        "/app/Silent-Face-Anti-Spoofing",
    ])
    return paths


_possible_paths = _get_silent_face_paths()

for path in _possible_paths:
    abs_path = os.path.abspath(path)
    src_path = os.path.join(abs_path, "src")
    anti_spoof_file = os.path.join(src_path, "anti_spoof_predict.py")
    if os.path.exists(src_path) and os.path.exists(anti_spoof_file):
        SILENT_FACE_REPO_PATH = abs_path
        logger.info("Found Silent-Face-Anti-Spoofing repo at: %s", abs_path)
        break

_SILENT_FACE_IMPORT_ERROR: Optional[str] = None

try:
    if SILENT_FACE_REPO_PATH and os.path.exists(SILENT_FACE_REPO_PATH):
        if SILENT_FACE_REPO_PATH not in sys.path:
            sys.path.insert(0, SILENT_FACE_REPO_PATH)
            logger.info("Added Silent-Face-Anti-Spoofing to sys.path: %s", SILENT_FACE_REPO_PATH)
        src_test = os.path.join(SILENT_FACE_REPO_PATH, "src", "anti_spoof_predict.py")
        if not os.path.exists(src_test):
            raise ImportError(f"src/anti_spoof_predict.py not found at expected path: {src_test}")
        from src.anti_spoof_predict import AntiSpoofPredict  # noqa: E402
        from src.generate_patches import CropImage  # noqa: E402

        SILENT_FACE_AVAILABLE = True
        logger.info("Silent-Face-Anti-Spoofing imported from: %s", SILENT_FACE_REPO_PATH)
    else:
        checked = [os.path.abspath(p) for p in _possible_paths]
        raise ImportError(
            f"Silent-Face-Anti-Spoofing repository not found. Checked paths: {checked}. "
            "Set SILENT_FACE_PATH to the repo root or place it at /app/Silent-Face-Anti-Spoofing."
        )
except (ImportError, ModuleNotFoundError, Exception) as e:
    SILENT_FACE_AVAILABLE = False
    _SILENT_FACE_IMPORT_ERROR = f"{type(e).__name__}: {e}"
    logger.error(
        "Silent-Face-Anti-Spoofing not available (%s). Spoof detection will not start until it is installed.",
        _SILENT_FACE_IMPORT_ERROR,
    )
    logger.debug("Import traceback:\n%s", traceback.format_exc())


def _require_silent_face_or_raise() -> None:
    if not SILENT_FACE_AVAILABLE:
        checked = [os.path.abspath(p) for p in _get_silent_face_paths()]
        msg = (
            "Silent-Face-Anti-Spoofing is required but not available. "
            f"Last error: {_SILENT_FACE_IMPORT_ERROR or 'unknown'}. "
            f"Checked paths: {checked}. Set SILENT_FACE_PATH or install from "
            "https://github.com/minivision-ai/Silent-Face-Anti-Spoofing"
        )
        err = (_SILENT_FACE_IMPORT_ERROR or "").lower()
        if "torch" in err or "no module named 'torch'" in err:
            msg += (
                " For `No module named 'torch'`, install deps in the **same venv** you use to run "
                "the server: `pip install -r requirements.txt` from `liveliness-backend` "
                "(DeepFace pulls a large stack; ensure several GB free disk)."
            )
        raise RuntimeError(msg)


class SpoofDetectionService:
    """
    Anti-spoofing via Silent-Face-Anti-Spoofing only (no heuristic fallback).
    """

    def __init__(self, model_dir: Optional[str] = None):
        _require_silent_face_or_raise()

        repo_base = None
        resolved_model_dir = model_dir
        if resolved_model_dir is None:
            for base_path in _get_silent_face_paths():
                abs_path = os.path.abspath(base_path)
                model_path = os.path.join(abs_path, "resources", "anti_spoof_models")
                if os.path.exists(model_path):
                    resolved_model_dir = model_path
                    repo_base = abs_path
                    break
            else:
                resolved_model_dir = None

        if repo_base is None:
            repo_base = SILENT_FACE_REPO_PATH

        if not resolved_model_dir or not os.path.isdir(resolved_model_dir):
            raise RuntimeError(
                "Silent-Face resources/anti_spoof_models not found. "
                "Download model .pth files into the Silent-Face repo resources/anti_spoof_models."
            )
        if not repo_base or not os.path.isdir(repo_base):
            raise RuntimeError("Silent-Face repo base path is invalid.")

        self.model_dir = resolved_model_dir
        self.repo_base = repo_base

        detection_model_dir = os.path.join(self.repo_base, "resources", "detection_model")
        deploy_file = os.path.join(detection_model_dir, "deploy.prototxt")
        caffemodel_file = os.path.join(detection_model_dir, "Widerface-RetinaFace.caffemodel")
        if not os.path.exists(deploy_file) or not os.path.exists(caffemodel_file):
            raise RuntimeError(
                f"Silent-Face detection models missing under {detection_model_dir}. "
                "Install deploy.prototxt and Widerface-RetinaFace.caffemodel."
            )

        pth_files = [f for f in os.listdir(self.model_dir) if f.endswith(".pth")]
        if not pth_files:
            raise RuntimeError(
                f"No .pth anti-spoof models in {self.model_dir}. "
                "Download weights from the Silent-Face-Anti-Spoofing repository."
            )

        original_cwd = os.getcwd()
        try:
            os.chdir(self.repo_base)
            if not os.path.exists("./resources/detection_model/deploy.prototxt"):
                raise FileNotFoundError(
                    f"Relative path ./resources/detection_model/deploy.prototxt not found from {os.getcwd()}"
                )
            self.device_id = 0
            self.model = AntiSpoofPredict(self.device_id)
            self.image_cropper = CropImage()
            logger.info("AntiSpoofPredict initialized successfully")
        finally:
            os.chdir(original_cwd)

        logger.info(
            "SpoofDetectionService ready: model_dir=%s models=%s",
            self.model_dir,
            pth_files,
        )

    async def detect_spoof(self, image_bytes: bytes, confidence_threshold: float = 0.8) -> dict:
        try:
            return await self._detect_with_silent_face(image_bytes, confidence_threshold)
        except Exception as e:
            logger.error("Spoof detection error: %s", str(e), exc_info=True)
            return {
                "is_real": False,
                "confidence": 0.0,
                "reason": f"Spoof detection failed: {str(e)}",
            }

    async def _detect_with_silent_face(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
    ) -> dict:
        import os as _os

        from src.utility import parse_model_name

        original_cwd = _os.getcwd()
        if hasattr(self, "repo_base"):
            _os.chdir(self.repo_base)
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("Failed to decode image")

            logger.info("Processing image: shape=%s", image.shape)

            image_bbox = self.model.get_bbox(image)
            logger.info("Face bbox detected: %s", image_bbox)

            prediction = np.zeros((1, 3))

            model_files = [f for f in os.listdir(self.model_dir) if f.endswith(".pth")]
            if not model_files:
                raise ValueError(f"No model files (.pth) found in {self.model_dir}")

            logger.info("Running prediction with %d models...", len(model_files))

            for model_name in model_files:
                h_input, w_input, model_type, scale = parse_model_name(model_name)
                param = {
                    "org_img": image,
                    "bbox": image_bbox,
                    "scale": scale,
                    "out_w": w_input,
                    "out_h": h_input,
                    "crop": True,
                }
                if scale is None:
                    param["crop"] = False
                img_cropped = self.image_cropper.crop(**param)
                model_path = os.path.join(self.model_dir, model_name)
                result = self.model.predict(img_cropped, model_path)
                prediction += result
                logger.info("Model %s prediction: %s", model_name, result)

            prediction = prediction / len(model_files)
            label = int(np.argmax(prediction))
            value = float(prediction[0][label])

            is_real = (label == 1) and (value >= confidence_threshold)

            logger.info(
                "Final spoof detection: label=%s raw_conf=%.4f threshold=%.2f is_real=%s",
                label,
                value,
                confidence_threshold,
                is_real,
            )

            if not is_real:
                if label == 1:
                    reason = (
                        f"Uncertain: real label but confidence ({value:.2%}) below threshold ({confidence_threshold:.2%})"
                    )
                else:
                    reason = f"Detected as spoof (label={label}, score={value:.2%})"
            else:
                reason = f"Detected as real face (confidence={value:.2%})"

            return {
                "is_real": is_real,
                "confidence": value,
                "reason": reason,
                "details": {
                    "label": label,
                    "prediction": prediction[0].tolist(),
                    "method": "silent_face_anti_spoofing",
                },
            }
        finally:
            _os.chdir(original_cwd)
