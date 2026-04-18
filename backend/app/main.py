"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.errors import install_exception_handlers
from app.api.routers import campaigns, health, sessions
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.init_db import init_models

configure_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("app.startup", version=__version__)
    await init_models()
    yield
    log.info("app.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Poonawalla Loan Wizard API",
        version=__version__,
        description="Video-based digital loan origination, KYC, risk and offer engine.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(campaigns.router)
    app.include_router(sessions.router)

    return app


app = create_app()
