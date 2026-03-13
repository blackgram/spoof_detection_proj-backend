"""Lazy-loaded ML services so Cloud Run can bind to PORT quickly."""

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
