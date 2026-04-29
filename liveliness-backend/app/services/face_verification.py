from deepface import DeepFace
from PIL import Image
import io
import numpy as np
import tempfile
import os
import logging

logger = logging.getLogger(__name__)


class FaceVerificationService:
    """
    Service for face verification (1:1 matching) using DeepFace.
    Uses ArcFace model for better accuracy.
    """
    
    def __init__(self):
        self.model_name = "ArcFace"  # Best accuracy, alternatives: "Facenet", "VGG-Face"
        self.detector_backend = "retinaface"  # More robust face detection
        logger.info(f"FaceVerificationService initialized with model: {self.model_name}")
    
    async def verify_faces(
        self, 
        image1_bytes: bytes, 
        image2_bytes: bytes,
        threshold: float = 0.68  # ArcFace threshold (lower = stricter)
    ) -> dict:
        """
        Verify if two face images belong to the same person.
        
        Args:
            image1_bytes: Reference image (ID photo) as bytes
            image2_bytes: Query image (selfie) as bytes
            threshold: Distance threshold for verification (default for ArcFace)
        
        Returns:
            dict with 'verified', 'confidence', and 'distance' keys
        """
        # Use temporary files for DeepFace (it requires file paths)
        temp_file1 = None
        temp_file2 = None
        
        try:
            # Validate that we have actual bytes
            if not image1_bytes or len(image1_bytes) == 0:
                raise ValueError("First image is empty or invalid")
            if not image2_bytes or len(image2_bytes) == 0:
                raise ValueError("Second image is empty or invalid")
            
            # Convert bytes to PIL Images
            try:
                image1 = Image.open(io.BytesIO(image1_bytes))
            except Exception as e:
                raise ValueError(f"Failed to read first image: {str(e)}. Image may be corrupted or in unsupported format.")
            
            try:
                image2 = Image.open(io.BytesIO(image2_bytes))
            except Exception as e:
                raise ValueError(f"Failed to read second image: {str(e)}. Image may be corrupted or in unsupported format.")
            
            # Convert to RGB if necessary
            if image1.mode != 'RGB':
                image1 = image1.convert('RGB')
            if image2.mode != 'RGB':
                image2 = image2.convert('RGB')
            
            # Create temporary files for DeepFace
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp1:
                image1.save(tmp1, format='JPEG')
                temp_file1 = tmp1.name
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp2:
                image2.save(tmp2, format='JPEG')
                temp_file2 = tmp2.name
            
            logger.info("Starting face verification with DeepFace...")
            logger.info(f"Model: {self.model_name}, Detector: {self.detector_backend}")
            logger.info(f"Temporary files: {temp_file1}, {temp_file2}")
            
            # Perform verification using file paths
            logger.info("Calling DeepFace.verify()...")
            result = DeepFace.verify(
                img1_path=temp_file1,
                img2_path=temp_file2,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=True,  # Raise error if face not detected
                distance_metric="cosine"
            )
            
            logger.info(f"DeepFace raw result: {result}")
            
            # Extract results
            verified = result["verified"]
            distance = float(result["distance"])
            threshold_used = float(result["threshold"])
            
            # Calculate confidence (inverse of distance, normalized)
            # Distance of 0 = perfect match (confidence 1.0)
            # Distance approaching threshold = lower confidence
            if distance < threshold_used:
                # Normalize confidence: distance 0 = 1.0, distance = threshold = ~0.5
                confidence = max(0.0, min(1.0, 1.0 - (distance / threshold_used) * 0.5))
            else:
                confidence = 0.0
            
            logger.info(
                f"Face verification result: verified={verified}, "
                f"distance={distance:.4f}, confidence={confidence:.2%}"
            )
            
            return {
                "verified": verified,
                "confidence": confidence,
                "distance": distance
            }
            
        except ValueError as e:
            error_msg = str(e)
            if "Face could not be detected" in error_msg or "No face detected" in error_msg:
                raise ValueError(
                    "Face could not be detected in one or both images. "
                    "Please ensure images contain clear, front-facing faces."
                )
            raise ValueError(f"Face verification failed: {error_msg}")
        
        except Exception as e:
            logger.error(f"Face verification error: {str(e)}", exc_info=True)
            raise Exception(f"Face verification failed: {str(e)}")
        
        finally:
            # Clean up temporary files
            if temp_file1 and os.path.exists(temp_file1):
                try:
                    os.unlink(temp_file1)
                except Exception:
                    pass
            if temp_file2 and os.path.exists(temp_file2):
                try:
                    os.unlink(temp_file2)
                except Exception:
                    pass

