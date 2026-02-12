import cv2
import numpy as np
from PIL import Image
import io
import logging
import os

logger = logging.getLogger(__name__)

# Try to import Silent-Face-Anti-Spoofing
# We need to add the repo root (not src) to the path so "from src.xxx" works
SILENT_FACE_REPO_PATH = None

# Paths to check (env var first for Docker/Render, then relative paths)
def _get_silent_face_paths():
    paths = []
    env_path = os.environ.get("SILENT_FACE_PATH")
    if env_path:
        paths.append(env_path)
    paths.extend([
        os.path.join(os.path.dirname(__file__), '../../Silent-Face-Anti-Spoofing'),
        os.path.join(os.path.dirname(__file__), '../../../Silent-Face-Anti-Spoofing'),
        '/app/Silent-Face-Anti-Spoofing',  # Docker default
    ])
    return paths

possible_paths = _get_silent_face_paths()

for path in possible_paths:
    abs_path = os.path.abspath(path)
    src_path = os.path.join(abs_path, 'src')
    anti_spoof_file = os.path.join(src_path, 'anti_spoof_predict.py')
    
    if os.path.exists(src_path) and os.path.exists(anti_spoof_file):
        SILENT_FACE_REPO_PATH = abs_path
        logger.info(f"Found Silent-Face-Anti-Spoofing repo at: {abs_path}")
        break

try:
    if SILENT_FACE_REPO_PATH and os.path.exists(SILENT_FACE_REPO_PATH):
        import sys
        # Add the repo root to path so "from src.xxx" imports work
        if SILENT_FACE_REPO_PATH not in sys.path:
            sys.path.insert(0, SILENT_FACE_REPO_PATH)
            logger.info(f"Added Silent-Face-Anti-Spoofing to sys.path: {SILENT_FACE_REPO_PATH}")
        
        # Verify the path is correct
        src_test = os.path.join(SILENT_FACE_REPO_PATH, 'src', 'anti_spoof_predict.py')
        if not os.path.exists(src_test):
            raise ImportError(f"src/anti_spoof_predict.py not found at expected path: {src_test}")
        
        logger.info(f"Attempting to import from: {SILENT_FACE_REPO_PATH}")
        
        # Now try to import
        from src.anti_spoof_predict import AntiSpoofPredict
        from src.generate_patches import CropImage
        from src.utility import parse_model_name
        
        SILENT_FACE_AVAILABLE = True
        logger.info(f"✅ Silent-Face-Anti-Spoofing successfully imported from: {SILENT_FACE_REPO_PATH}")
    else:
        checked = [os.path.abspath(p) for p in possible_paths]
        raise ImportError(f"Silent-Face-Anti-Spoofing repository not found. Checked paths: {checked}")
except (ImportError, ModuleNotFoundError, Exception) as e:
    SILENT_FACE_AVAILABLE = False
    error_msg = str(e)
    error_type = type(e).__name__
    
    # Log the full traceback for debugging
    import traceback
    logger.warning(
        f"Silent-Face-Anti-Spoofing not available ({error_type}): {error_msg}. "
        "Using basic spoof detection."
    )
    logger.debug(f"Full error traceback:\n{traceback.format_exc()}")
    
    if SILENT_FACE_REPO_PATH:
        logger.warning(f"Repo path was found at: {SILENT_FACE_REPO_PATH} but import still failed")
        logger.warning(f"sys.path contains: {sys.path[:5]}...")  # Show first 5 entries


class SpoofDetectionService:
    """
    Service for spoof detection (anti-spoofing) using Silent-Face-Anti-Spoofing.
    Detects printed photos, screen replays, and basic 3D masks.
    """
    
    def __init__(self, model_dir: str = None):
        # Find the model directory and repo base
        repo_base = None
        if model_dir is None:
            # Try to find Silent-Face-Anti-Spoofing repository
            base_paths = _get_silent_face_paths()
            for base_path in base_paths:
                abs_path = os.path.abspath(base_path)
                model_path = os.path.join(abs_path, 'resources', 'anti_spoof_models')
                if os.path.exists(model_path):
                    model_dir = model_path
                    repo_base = abs_path
                    break
            else:
                model_dir = None
        
        # Fallback to SILENT_FACE_REPO_PATH if not found above
        if repo_base is None:
            repo_base = SILENT_FACE_REPO_PATH
        
        self.model_dir = model_dir
        self.repo_base = repo_base
        self.use_silent_face = SILENT_FACE_AVAILABLE and model_dir is not None and repo_base is not None
        
        if self.use_silent_face:
            try:
                # Verify the repo directory exists
                if not os.path.exists(self.repo_base):
                    raise ValueError(f"Repo base directory does not exist: {self.repo_base}")
                
                # Silent-Face-Anti-Spoofing uses relative paths (./resources/...)
                # So we need to change to the repo directory during initialization
                original_cwd = os.getcwd()
                try:
                    # Verify repo_base exists and has the required files
                    if not os.path.exists(self.repo_base):
                        raise ValueError(f"Repo base directory does not exist: {self.repo_base}")
                    
                    # Verify detection model files exist before changing directory
                    detection_model_dir = os.path.join(self.repo_base, 'resources', 'detection_model')
                    deploy_file = os.path.join(detection_model_dir, 'deploy.prototxt')
                    caffemodel_file = os.path.join(detection_model_dir, 'Widerface-RetinaFace.caffemodel')
                    
                    if not os.path.exists(deploy_file):
                        raise FileNotFoundError(f"Detection model not found: {deploy_file}")
                    if not os.path.exists(caffemodel_file):
                        raise FileNotFoundError(f"Detection model not found: {caffemodel_file}")
                    
                    logger.info(f"Detection model files verified at: {detection_model_dir}")
                    
                    # Change to repo directory for relative paths
                    os.chdir(self.repo_base)
                    current_dir = os.getcwd()
                    logger.info(f"Changed working directory to: {current_dir} (was: {original_cwd})")
                    
                    # Verify we can see the files with relative path
                    if not os.path.exists('./resources/detection_model/deploy.prototxt'):
                        raise FileNotFoundError(
                            f"Relative path './resources/detection_model/deploy.prototxt' not found from {current_dir}"
                        )
                    
                    # Initialize Anti-Spoof model
                    # Model files should be in model_dir (download from GitHub repo)
                    self.device_id = 0  # 0 for CPU, use GPU if available
                    self.model = AntiSpoofPredict(self.device_id)
                    self.image_cropper = CropImage()
                    logger.info("✅ AntiSpoofPredict initialized successfully")
                finally:
                    # Restore original directory
                    os.chdir(original_cwd)
                
                # Check if model files exist
                if not os.path.exists(model_dir):
                    logger.warning(
                        f"Model directory {model_dir} not found. "
                        "Please download models from Silent-Face-Anti-Spoofing repository."
                    )
                    self.use_silent_face = False
                else:
                    # List available models
                    model_files = [f for f in os.listdir(model_dir) if f.endswith('.pth')]
                    logger.info(f"✅ SpoofDetectionService initialized with Silent-Face-Anti-Spoofing")
                    logger.info(f"Model directory: {model_dir}")
                    logger.info(f"Available models: {model_files}")
            except Exception as e:
                logger.error(f"Failed to initialize Silent-Face-Anti-Spoofing: {str(e)}", exc_info=True)
                self.use_silent_face = False
        
        if not self.use_silent_face:
            logger.info("SpoofDetectionService initialized with basic detection (fallback)")
    
    async def detect_spoof(self, image_bytes: bytes, confidence_threshold: float = 0.8) -> dict:
        """
        Detect if an image is from a real person or a spoof (printed photo, screen, etc.).
        
        Args:
            image_bytes: Image as bytes
            confidence_threshold: Minimum confidence to consider as real (default: 0.8)
        
        Returns:
            dict with 'is_real', 'confidence', and optional 'reason' keys
        """
        try:
            if self.use_silent_face:
                return await self._detect_with_silent_face(image_bytes, confidence_threshold)
            else:
                return await self._detect_basic(image_bytes)
        
        except Exception as e:
            logger.error(f"Spoof detection error: {str(e)}", exc_info=True)
            # Fail open - assume real if detection fails (can be changed to fail closed)
            return {
                "is_real": True,
                "confidence": 0.5,
                "reason": f"Detection error: {str(e)}"
            }
    
    async def _detect_with_silent_face(
        self, 
        image_bytes: bytes, 
        confidence_threshold: float
    ) -> dict:
        """Use Silent-Face-Anti-Spoofing library for detection"""
        import os
        try:
            # Change to repo directory for relative paths (for detection model)
            original_cwd = os.getcwd()
            if hasattr(self, 'repo_base'):
                os.chdir(self.repo_base)
            
            try:
                # Convert bytes to OpenCV image
                nparr = np.frombuffer(image_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if image is None:
                    raise ValueError("Failed to decode image")
                
                logger.info(f"Processing image: shape={image.shape}")
                
                # Get face bounding box
                image_bbox = self.model.get_bbox(image)
                logger.info(f"Face bbox detected: {image_bbox}")
                
                # Initialize prediction accumulator (for multi-model fusion)
                prediction = np.zeros((1, 3))  # 3 classes: [fake, real, other]
                
                # Run prediction for each model in the directory
                model_files = [f for f in os.listdir(self.model_dir) if f.endswith('.pth')]
                
                if not model_files:
                    raise ValueError(f"No model files (.pth) found in {self.model_dir}")
                
                logger.info(f"Running prediction with {len(model_files)} models...")
                
                for model_name in model_files:
                    from src.utility import parse_model_name
                    h_input, w_input, model_type, scale = parse_model_name(model_name)
                    
                    # Crop image according to model requirements
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
                    
                    # Run prediction
                    model_path = os.path.join(self.model_dir, model_name)
                    result = self.model.predict(img_cropped, model_path)
                    prediction += result
                    logger.info(f"Model {model_name} prediction: {result}")
                
                # Average the predictions
                prediction = prediction / len(model_files)
                
                # Get final result (label 1 = real, 0 or 2 = fake/spoof)
                label = np.argmax(prediction)
                value = prediction[0][label]
                confidence = float(value)
                
                # Apply confidence threshold: even if label is "real" (1), 
                # we need high confidence to trust it
                # label 1 = real face, label 0 or 2 = fake
                is_real = (label == 1) and (confidence >= confidence_threshold)
                
                logger.info(
                    f"Final spoof detection: label={label}, raw_confidence={confidence:.4f}, "
                    f"threshold={confidence_threshold:.2f}, is_real={is_real}, "
                    f"prediction={prediction[0]}"
                )
                
                if not is_real:
                    if label == 1:
                        # Label says "real" but confidence too low
                        reason = f"Uncertain result: label indicates real face but confidence ({confidence:.2%}) below threshold ({confidence_threshold:.2%})"
                    else:
                        reason = f"Detected as spoof (label={label}, score={confidence:.2%})"
                else:
                    reason = f"Detected as real face (confidence={confidence:.2%})"
                
                return {
                    "is_real": is_real,
                    "confidence": confidence,
                    "reason": reason,
                    "details": {
                        "label": int(label),
                        "prediction": prediction[0].tolist(),
                        "method": "silent_face_anti_spoofing"
                    }
                }
            
            finally:
                # Restore original directory
                os.chdir(original_cwd)
        
        except Exception as e:
            logger.error(f"Silent-Face detection failed: {str(e)}", exc_info=True)
            raise
    
    async def _detect_basic(self, image_bytes: bytes) -> dict:
        """
        Basic spoof detection fallback.
        Uses simple heuristics (image quality, edges, etc.)
        Note: This is a placeholder - should be replaced with proper model
        """
        try:
            # Validate bytes
            if not image_bytes or len(image_bytes) == 0:
                raise ValueError("Image bytes are empty")
            
            # Convert bytes to PIL Image
            try:
                image = Image.open(io.BytesIO(image_bytes))
            except Exception as e:
                raise ValueError(f"Failed to read image: {str(e)}. Image may be corrupted or in unsupported format.")
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            logger.info(f"Image loaded: size={image.size}, mode={image.mode}, format={image.format}")
            
            # Convert to numpy array
            img_array = np.array(image)
            logger.info(f"Image array shape: {img_array.shape}, dtype: {img_array.dtype}")
            
            # Convert to OpenCV format (BGR)
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            # Convert to grayscale for analysis
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            
            # Basic heuristics for spoof detection
            # These are very simple and not production-ready
            
            # 1. Check image blur/sharpness (screens often have moiré patterns)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            logger.info(f"Image sharpness (Laplacian variance): {laplacian_var:.2f}")
            
            # 2. Check color variance (printed photos may have less variance)
            color_variance = np.var(img_array, axis=(0, 1))
            avg_variance = np.mean(color_variance)
            logger.info(f"Color variance (R, G, B): {color_variance}, Average: {avg_variance:.2f}")
            
            # 3. Edge detection (real faces have more natural edges)
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / (edges.shape[0] * edges.shape[1])
            logger.info(f"Edge density: {edge_density:.4f}")
            
            # Very basic scoring (these thresholds are arbitrary and should be tuned)
            # Lower sharpness might indicate screen
            # Lower color variance might indicate printed photo
            # Start with assumption it's real (since basic detection is unreliable)
            score = 0.7  # Start optimistic (basic detection tends to false positives)
            
            # Only flag obvious issues, not borderline cases
            if laplacian_var < 50:  # Very blurry - more likely screen
                logger.warning(f"⚠️  Very low sharpness detected ({laplacian_var:.2f}), might indicate screen display")
                score -= 0.15
            elif laplacian_var > 800:  # Extremely sharp - possible printed photo
                logger.info(f"Extremely sharp image ({laplacian_var:.2f}), could be printed")
                score -= 0.1
            
            if avg_variance < 300:  # Very low color variance - suspicious
                logger.warning(f"⚠️  Very low color variance ({avg_variance:.2f}), might indicate printed photo")
                score -= 0.1
            
            # Clamp score - keep it reasonable
            score = max(0.4, min(0.85, score))
            confidence = score
            
            # Be more lenient - only fail if score is clearly low
            # Since basic detection is unreliable, err on side of passing
            is_real = score >= 0.70  # Slightly higher threshold but more lenient scoring
            
            logger.warning(
                f"⚠️  BASIC SPOOF DETECTION (NOT RELIABLE): "
                f"is_real={is_real}, confidence={confidence:.2%}, "
                f"sharpness={laplacian_var:.2f}, color_var={avg_variance:.2f}, edge_density={edge_density:.4f}"
            )
            logger.warning(
                "⚠️  ⚠️  ⚠️  INSTALL Silent-Face-Anti-Spoofing for proper spoof detection! "
                "Current detection is just basic heuristics and NOT production-ready."
            )
            
            reason = (
                f"Basic detection (UNRELIABLE - install Silent-Face-Anti-Spoofing for real detection). "
                f"Analysis: sharpness={laplacian_var:.1f}, color_variance={avg_variance:.1f}"
            )
            
            return {
                "is_real": is_real,
                "confidence": confidence,
                "reason": reason,
                "details": {
                    "sharpness": float(laplacian_var),
                    "color_variance": float(avg_variance),
                    "edge_density": float(edge_density),
                    "method": "basic_heuristics"
                }
            }
        
        except Exception as e:
            logger.error(f"Basic detection failed: {str(e)}")
            raise

