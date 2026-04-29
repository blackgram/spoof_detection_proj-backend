"""Minimal settings for liveliness-backend (env / .env in this package root)."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> bool:
    """Load KEY=VALUE lines from path into os.environ."""
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
                    os.environ[k] = v
    return True


def _ensure_env_loaded() -> None:
    if _load_dotenv(_BACKEND_ROOT / ".env"):
        return
    _load_dotenv(Path.cwd() / ".env")


class Settings(BaseSettings):
    """ACCESS_BANK_EFM_URL and ACCESS_BANK_EFM_AUTH_TOKEN are read by account_image (os.environ)."""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    _ensure_env_loaded()
    return Settings()
