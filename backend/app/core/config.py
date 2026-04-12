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
    GROQ_API_KEY: str | None
    GROQ_BASE_URL: str
    GROQ_MODEL: str
    GROQ_RESPONSE_FORMAT: str
    GROQ_TIMEOUT_SECONDS: float


@lru_cache
def get_settings() -> Settings:
    environment = os.getenv("ENVIRONMENT", "development").strip().lower() or "development"
    allowed_origins = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS"))
    groq_response_format = (
        os.getenv("GROQ_RESPONSE_FORMAT", "auto").strip().lower() or "auto"
    )
    timeout_seconds = float(os.getenv("GROQ_TIMEOUT_SECONDS", "20").strip() or "20")

    if environment == "production" and "*" in allowed_origins:
        raise ValueError("ALLOWED_ORIGINS cannot contain '*' in production.")
    if groq_response_format not in {"auto", "json_schema", "json_object"}:
        raise ValueError(
            "GROQ_RESPONSE_FORMAT must be one of: auto, json_schema, json_object."
        )
    if timeout_seconds <= 0:
        raise ValueError("GROQ_TIMEOUT_SECONDS must be positive.")

    return Settings(
        ENVIRONMENT=environment,
        ALLOWED_ORIGINS=allowed_origins,
        GROQ_API_KEY=os.getenv("GROQ_API_KEY"),
        GROQ_BASE_URL=(
            os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").strip()
            or "https://api.groq.com/openai/v1"
        ),
        GROQ_MODEL=(
            os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
            or "openai/gpt-oss-20b"
        ),
        GROQ_RESPONSE_FORMAT=groq_response_format,
        GROQ_TIMEOUT_SECONDS=timeout_seconds,
    )


settings = get_settings()
