"""Persistent ORM entities.

Models are intentionally thin: business logic lives in services, not on
entities. This is the **Single Responsibility Principle** applied to the
persistence layer.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid_pk() -> Mapped[UUID]:
    return mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)


def _utcnow() -> datetime:
    return datetime.utcnow()


class LoanSession(Base):
    __tablename__ = "loan_sessions"

    id: Mapped[UUID] = _uuid_pk()
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="created", index=True)
    campaign_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="link")
    referral_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    customer_msisdn: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    customer_email: Mapped[str | None] = mapped_column(String(128), nullable=True)

    geo_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    device_meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    extracted_profile: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    bureau_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    risk_assessment: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    age_estimation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    liveness_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    decision: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    recording_uri: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )

    transcripts: Mapped[list["TranscriptRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    consents: Mapped[list["Consent"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    offers: Mapped[list["Offer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    audit_events: Mapped[list["AuditEvent"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class TranscriptRecord(Base):
    __tablename__ = "transcripts"

    id: Mapped[UUID] = _uuid_pk()
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loan_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    start_s: Mapped[float] = mapped_column(Float, nullable=False)
    end_s: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    speaker: Mapped[str] = mapped_column(String(32), nullable=False, default="customer")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    session: Mapped[LoanSession] = relationship(back_populates="transcripts")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[UUID] = _uuid_pk()
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loan_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consent_type: Mapped[str] = mapped_column(String(64), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    transcript_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    session: Mapped[LoanSession] = relationship(back_populates="consents")


class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[UUID] = _uuid_pk()
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loan_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    offer_ref: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    principal_amount: Mapped[float] = mapped_column(Float, nullable=False)
    tenure_months: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rate_pa: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_emi: Mapped[float] = mapped_column(Float, nullable=False)
    processing_fee: Mapped[float] = mapped_column(Float, nullable=False)
    total_payable: Mapped[float] = mapped_column(Float, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    session: Mapped[LoanSession] = relationship(back_populates="offers")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[UUID] = _uuid_pk()
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loan_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False, index=True)

    session: Mapped[LoanSession] = relationship(back_populates="audit_events")
