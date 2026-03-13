"""App configuration from environment."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# Backend root = directory containing app/ (where .env lives)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> bool:
    """Load KEY=VALUE lines from path into os.environ. Returns True if file was loaded."""
    if not path.exists():
        return False
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip("'\"")
                if k:
                    os.environ[k] = v  # overwrite so .env always wins
    return True


def _ensure_env_loaded() -> None:
    """Load .env from backend root or cwd so FIRESTORE_PROJECT_ID is set before Settings()."""
    if os.environ.get("FIRESTORE_PROJECT_ID"):
        return  # already set
    # Try backend/.env first (relative to this file), then cwd
    if _load_dotenv(_BACKEND_ROOT / ".env"):
        return
    _load_dotenv(Path.cwd() / ".env")


class Settings(BaseSettings):
    """Application settings. Use env vars or .env file."""

    firestore_project_id: str | None = None
    google_application_credentials: str | None = None

    # FIDO2 / Passkey relying party (e.g. "localhost" for dev, "yourapp.com" for prod)
    fido2_rp_id: str = "localhost"
    fido2_rp_name: str = "AccessMore"

    # Dev-only: if true, relax python-fido2 origin checks (accept any origin).
    # NEVER enable this in production.
    fido2_allow_any_origin: bool = False

    # Android Digital Asset Links (for passkeys). Comma-separated SHA256 cert fingerprints (e.g. "AB:CD:...")
    android_package_name: str = "com.blackgram.spoofdetectionmobile"
    android_sha256_cert_fingerprints: str = ""

    # iOS Associated Domains (for passkeys). Team ID from Apple Developer / Xcode Signing.
    ios_bundle_id: str = "com.blackgram.spoofdetectionmobile"
    ios_team_id: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    _ensure_env_loaded()
    return Settings()
