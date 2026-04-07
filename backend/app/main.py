"""FastAPI application entry point."""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import analysis


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="FatigueSim Pro",
    description="Fatigue life analysis API with classical mean stress correction models",
    version=os.getenv("APP_VERSION", "0.1.0"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok", "service": "fatigue-backend", "version": app.version}
