"""Loan session endpoints — drive the full origination flow.

Endpoints:
  POST   /sessions                    create a session
  POST   /sessions/{id}/geo           attach geo-location
  POST   /sessions/{id}/device        attach device/IP/UA metadata
  POST   /sessions/{id}/audio         upload an audio chunk for STT
  POST   /sessions/{id}/face          upload face frames for age + liveness
  POST   /sessions/{id}/consent       record a single consent
  POST   /sessions/{id}/finalize      run full LLM + risk + offer pipeline
  GET    /sessions/{id}               return session detail (incl. decision)
  GET    /sessions/{id}/audit         return audit log for the session
  GET    /sessions/{id}/transcript    return transcript segments
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_audit_repository, get_orchestrator
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.entities import LoanSession, Offer, TranscriptRecord
from app.schemas.domain import (
    ConsentRecord,
    DecisionResult,
    GeoLocation,
    SessionCreateRequest,
    TranscriptSegment,
)
from app.services.audit import SqlAuditRepository
from app.services.session_orchestrator import SessionOrchestrator

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=dict)
async def create_session(
    req: SessionCreateRequest,
    request: Request,
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    sid = await orch.create_session(req)
    await orch.attach_device(
        sid,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        meta=None,
    )
    return {"session_id": str(sid)}


@router.post("/{session_id}/geo")
async def attach_geo(
    session_id: UUID,
    geo: GeoLocation,
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    signals = await orch.attach_geo(session_id, geo)
    return {"fraud_signals": signals}


@router.post("/{session_id}/device")
async def attach_device(
    session_id: UUID,
    payload: dict,
    request: Request,
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    await orch.attach_device(
        session_id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        meta=payload or {},
    )
    return {"ok": True}


@router.post("/{session_id}/audio", response_model=List[TranscriptSegment])
async def upload_audio(
    session_id: UUID,
    audio: UploadFile = File(...),
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> List[TranscriptSegment]:
    blob = await audio.read()
    return await orch.ingest_audio(session_id, blob)


@router.post("/{session_id}/face")
async def upload_face_frames(
    session_id: UUID,
    frames: List[UploadFile] = File(...),
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    blobs = [await f.read() for f in frames]
    age_est, live = await orch.ingest_face_frames(session_id, blobs)
    return {
        "age_estimation": age_est.model_dump(mode="json"),
        "liveness": live.model_dump(mode="json"),
    }


@router.post("/{session_id}/consent")
async def record_consent(
    session_id: UUID,
    consent: ConsentRecord,
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    await orch.record_consent(session_id, consent)
    return {"ok": True}


@router.post("/{session_id}/finalize", response_model=DecisionResult)
async def finalize(
    session_id: UUID,
    orch: SessionOrchestrator = Depends(get_orchestrator),
) -> DecisionResult:
    return await orch.finalize(session_id)


@router.get("/{session_id}")
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    sess = await db.get(LoanSession, session_id)
    if not sess:
        raise NotFoundError(f"Session {session_id} not found")
    offers_stmt = select(Offer).where(Offer.session_id == session_id)
    offers = (await db.execute(offers_stmt)).scalars().all()
    return {
        "id": str(sess.id),
        "status": sess.status,
        "campaign_id": sess.campaign_id,
        "channel": sess.channel,
        "customer_msisdn": sess.customer_msisdn,
        "geo": {
            "lat": sess.geo_latitude,
            "lon": sess.geo_longitude,
            "accuracy_m": sess.geo_accuracy_m,
        },
        "extracted_profile": sess.extracted_profile,
        "bureau_snapshot": sess.bureau_snapshot,
        "risk_assessment": sess.risk_assessment,
        "age_estimation": sess.age_estimation,
        "liveness_result": sess.liveness_result,
        "decision": sess.decision,
        "offers": [
            {
                "offer_ref": o.offer_ref,
                "principal_amount": o.principal_amount,
                "tenure_months": o.tenure_months,
                "interest_rate_pa": o.interest_rate_pa,
                "monthly_emi": o.monthly_emi,
                "processing_fee": o.processing_fee,
                "total_payable": o.total_payable,
                "expires_at": o.expires_at.isoformat(),
            }
            for o in offers
        ],
        "created_at": sess.created_at.isoformat(),
        "updated_at": sess.updated_at.isoformat(),
    }


@router.get("/{session_id}/audit")
async def session_audit(
    session_id: UUID,
    audit: SqlAuditRepository = Depends(get_audit_repository),
) -> List[dict]:
    return await audit.list_for_session(session_id)


@router.get("/{session_id}/transcript", response_model=List[TranscriptSegment])
async def session_transcript(
    session_id: UUID, db: AsyncSession = Depends(get_db)
) -> List[TranscriptSegment]:
    stmt = (
        select(TranscriptRecord)
        .where(TranscriptRecord.session_id == session_id)
        .order_by(TranscriptRecord.seq.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        TranscriptSegment(
            start=r.start_s,
            end=r.end_s,
            text=r.text,
            speaker=r.speaker,
            confidence=r.confidence,
        )
        for r in rows
    ]
