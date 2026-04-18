"""Append-only audit repository backed by Postgres.

Every meaningful event in a session lands here with timestamps and JSON
payload — this is the **central repository for all internal/external logs**
referenced in the flow diagram.
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from sqlalchemy import select

from app.core.logging import get_logger
from app.db.session import session_scope
from app.models.entities import AuditEvent
from app.services.interfaces import IAuditRepository

log = get_logger(__name__)


class SqlAuditRepository(IAuditRepository):
    async def append(self, session_id: UUID, event_type: str, payload: dict) -> None:
        async with session_scope() as db:
            db.add(
                AuditEvent(
                    session_id=session_id,
                    event_type=event_type,
                    payload=payload or {},
                )
            )
        log.info("audit.event", session_id=str(session_id), event_type=event_type)

    async def list_for_session(self, session_id: UUID) -> List[dict]:
        async with session_scope() as db:
            stmt = (
                select(AuditEvent)
                .where(AuditEvent.session_id == session_id)
                .order_by(AuditEvent.created_at.asc())
            )
            rows = (await db.execute(stmt)).scalars().all()
            return [
                {
                    "id": str(r.id),
                    "event_type": r.event_type,
                    "payload": r.payload,
                    "created_at": r.created_at.isoformat(),
                }
                for r in rows
            ]
