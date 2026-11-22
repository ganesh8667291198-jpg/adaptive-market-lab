"""Application configuration."""
import os
from pathlib import Path


class Settings:
    APP_NAME: str = "Adaptive Market Lab"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    cors_extra = os.getenv("CORS_EXTRA_ORIGINS", "")
    if cors_extra:
        CORS_ORIGINS.extend([o.strip() for o in cors_extra.split(",") if o.strip()])

    # Upload
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_UPLOAD_SIZE_BYTES: int = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Cache
    CACHE_TTL_SECONDS: int = 300  # 5 minutes
    MAX_CACHE_ENTRIES: int = 50

    # Rate limiting
    RATE_LIMIT: str = "60/minute"

    # Data directory
    DATA_DIR: Path = Path(__file__).parent.parent / "data"


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
