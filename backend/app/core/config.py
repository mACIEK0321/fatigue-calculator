"""Application configuration sourced from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"]

load_dotenv(BACKEND_DIR / ".env")


def _parse_allowed_origins(raw_value: str | None) -> list[str]:
    if not raw_value:
        return DEFAULT_ALLOWED_ORIGINS.copy()

    origins: list[str] = []
    for origin in raw_value.split(","):
        normalized_origin = origin.strip().rstrip("/")
        if normalized_origin:
            origins.append(normalized_origin)

    return origins or DEFAULT_ALLOWED_ORIGINS.copy()


@dataclass(frozen=True)
class Settings:
    ENVIRONMENT: str
    ALLOWED_ORIGINS: list[str]
    DEEPSEEK_API_KEY: str | None
    DEEPSEEK_BASE_URL: str
    DEEPSEEK_MODEL: str
    DEEPSEEK_TIMEOUT_SECONDS: float


@lru_cache
def get_settings() -> Settings:
    environment = os.getenv("ENVIRONMENT", "development").strip().lower() or "development"
    allowed_origins = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS"))
    timeout_seconds = float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "20").strip() or "20")

    if environment == "production" and "*" in allowed_origins:
        raise ValueError("ALLOWED_ORIGINS cannot contain '*' in production.")
    if timeout_seconds <= 0:
        raise ValueError("DEEPSEEK_TIMEOUT_SECONDS must be positive.")

    return Settings(
        ENVIRONMENT=environment,
        ALLOWED_ORIGINS=allowed_origins,
        DEEPSEEK_API_KEY=os.getenv("DEEPSEEK_API_KEY"),
        DEEPSEEK_BASE_URL=(
            os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
            or "https://api.deepseek.com"
        ),
        DEEPSEEK_MODEL=(
            os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip() or "deepseek-chat"
        ),
        DEEPSEEK_TIMEOUT_SECONDS=timeout_seconds,
    )


settings = get_settings()
