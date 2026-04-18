"""Create database schema on first boot.

Idempotent: safe to call repeatedly. For real production use, replace this
with Alembic migrations (config files are in `backend/alembic/`).
"""
from __future__ import annotations

from app.core.logging import get_logger
from app.db.session import engine
from app.models import Base  # noqa: F401  ensures all models are registered

log = get_logger(__name__)


async def init_models() -> None:
    log.info("db.init.start")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("db.init.done")
