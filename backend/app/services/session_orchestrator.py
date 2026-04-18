"""Session orchestrator — the application use-case layer.

Implements the end-to-end flow from the architecture diagram:

    Campaign → Video → STT + Age + Geo → AutoFill → Policy + Risk + Bureau
             → LLM intelligence → Offers → Central audit repository

Depends only on **abstractions** (services/interfaces.py). Concrete
implementations are injected via the constructor — the rest of the app
never imports a concrete service.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Sequence
from uuid import UUID

from sqlalchemy import select

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.db.session import session_scope
from app.models.entities import (
    AuditEvent,
    Consent,
    LoanSession,
    Offer,
    TranscriptRecord,
)
from app.schemas.domain import (
    AgeEstimation,
    ConsentRecord,
    DecisionResult,
    ExtractedCustomerProfile,
    GeoLocation,
    LivenessResult,
    LoanOffer,
    SessionCreateRequest,
    TranscriptSegment,
)
from app.schemas.enums import (
    AuditEventType,
    DecisionOutcome,
    RiskBand,
    SessionStatus,
)
from app.services.interfaces import (
    IAgeEstimator,
    IAuditRepository,
    IBureauProvider,
    IGeoValidator,
    ILivenessChecker,
    ILLMClient,
    IOfferGenerator,
    IPolicyEngine,
    IRiskScorer,
    ISpeechToText,
)

log = get_logger(__name__)


class SessionOrchestrator:
    """Coordinates services through the loan-origination flow."""

    def __init__(
        self,
        *,
        stt: ISpeechToText,
        age_estimator: IAgeEstimator,
        liveness: ILivenessChecker,
        llm: ILLMClient,
        bureau: IBureauProvider,
        risk: IRiskScorer,
        policy: IPolicyEngine,
        offers: IOfferGenerator,
        geo: IGeoValidator,
        audit: IAuditRepository,
    ) -> None:
        self._stt = stt
        self._age = age_estimator
        self._liveness = liveness
        self._llm = llm
        self._bureau = bureau
        self._risk = risk
        self._policy = policy
        self._offers = offers
        self._geo = geo
        self._audit = audit
        # Serialize transcript persistence per session so concurrent audio
        # uploads never assign duplicate `seq` values.
        self._ingest_guard = asyncio.Lock()
        self._ingest_locks: Dict[UUID, asyncio.Lock] = {}

    async def _ingest_lock(self, session_id: UUID) -> asyncio.Lock:
        async with self._ingest_guard:
            lk = self._ingest_locks.get(session_id)
            if lk is None:
                lk = asyncio.Lock()
                self._ingest_locks[session_id] = lk
            return lk

    async def create_session(self, req: SessionCreateRequest) -> UUID:
        async with session_scope() as db:
            sess = LoanSession(
                status=SessionStatus.CREATED.value,
                campaign_id=req.campaign.campaign_id,
                channel=req.campaign.channel,
                referral_token=req.campaign.referral_token,
                customer_msisdn=req.customer_msisdn,
                customer_email=req.customer_email,
            )
            db.add(sess)
            await db.flush()
            sid = sess.id
        await self._audit.append(
            sid,
            AuditEventType.SESSION_STARTED.value,
            {"campaign_id": req.campaign.campaign_id, "channel": req.campaign.channel},
        )
        return sid

    async def attach_geo(self, session_id: UUID, geo: GeoLocation) -> List[str]:
        async with session_scope() as db:
            sess = await self._must_load(db, session_id)
            sess.geo_latitude = geo.latitude
            sess.geo_longitude = geo.longitude
            sess.geo_accuracy_m = geo.accuracy_m
        signals = await self._geo.validate(geo, declared_pincode=None)
        await self._audit.append(
            session_id,
            AuditEventType.GEO_CAPTURED.value,
            {"geo": geo.model_dump(mode="json"), "signals": signals},
        )
        if signals:
            await self._audit.append(
                session_id,
                AuditEventType.FRAUD_SIGNAL.value,
                {"source": "geo", "signals": signals},
            )
        return signals

    async def attach_device(
        self,
        session_id: UUID,
        ip: Optional[str],
        user_agent: Optional[str],
        meta: Optional[dict] = None,
    ) -> None:
        async with session_scope() as db:
            sess = await self._must_load(db, session_id)
            sess.ip_address = ip
            sess.user_agent = user_agent
            sess.device_meta = meta or {}

    async def ingest_audio(
        self, session_id: UUID, audio_bytes: bytes
    ) -> List[TranscriptSegment]:
        lock = await self._ingest_lock(session_id)
        async with lock:
            segments = await self._stt.transcribe(audio_bytes)
            if not segments:
                return []
            await self._persist_transcript(session_id, segments)
            await self._audit.append(
                session_id,
                AuditEventType.TRANSCRIPT_APPENDED.value,
                {"count": len(segments)},
            )
            return segments

    async def ingest_face_frames(
        self, session_id: UUID, frames: Sequence[bytes]
    ) -> tuple[AgeEstimation, LivenessResult]:
        age_est = await self._age.estimate(frames)
        live = await self._liveness.check(frames)
        async with session_scope() as db:
            sess = await self._must_load(db, session_id)
            sess.age_estimation = age_est.model_dump(mode="json")
            sess.liveness_result = live.model_dump(mode="json")
        await self._audit.append(
            session_id, AuditEventType.AGE_ESTIMATED.value, age_est.model_dump(mode="json")
        )
        await self._audit.append(
            session_id, AuditEventType.LIVENESS_CHECKED.value, live.model_dump(mode="json")
        )
        return age_est, live

    async def record_consent(self, session_id: UUID, consent: ConsentRecord) -> None:
        async with session_scope() as db:
            await self._must_load(db, session_id)
            db.add(
                Consent(
                    session_id=session_id,
                    consent_type=consent.consent_type.value,
                    granted=consent.granted,
                    transcript_excerpt=consent.transcript_excerpt,
                    captured_at=consent.captured_at,
                )
            )
        await self._audit.append(
            session_id,
            AuditEventType.CONSENT_CAPTURED.value,
            consent.model_dump(mode="json"),
        )

    async def finalize(self, session_id: UUID) -> DecisionResult:
        """Run LLM extraction → bureau → risk → policy → offer generation."""
        segments = await self._load_transcript(session_id)
        profile = await self._llm.extract_profile(segments)
        await self._audit.append(
            session_id,
            AuditEventType.LLM_EXTRACTION.value,
            profile.model_dump(mode="json"),
        )

        customer_ref = await self._derive_customer_ref(session_id)
        bureau = await self._bureau.fetch(customer_ref)
        risk = self._risk.score(profile, bureau)
        await self._audit.append(
            session_id, AuditEventType.RISK_EVALUATED.value, risk.model_dump(mode="json")
        )

        age_est = await self._load_age_estimation(session_id)
        policy_eval = self._policy.evaluate(profile, bureau, risk, age_est)
        await self._audit.append(
            session_id,
            AuditEventType.POLICY_EVALUATED.value,
            policy_eval.model_dump(mode="json"),
        )

        offers: List[LoanOffer] = []
        if policy_eval.passed:
            offers = self._offers.generate(profile, bureau, risk)
            await self._audit.append(
                session_id,
                AuditEventType.OFFER_GENERATED.value,
                {"count": len(offers), "offers": [o.model_dump(mode="json") for o in offers]},
            )

        outcome = self._decide(policy_eval.passed, risk.risk_band, offers)
        explanation = self._explain(profile, bureau, risk, policy_eval, offers)
        decision = DecisionResult(
            outcome=outcome,
            risk_band=risk.risk_band,
            explanation=explanation,
            offers=offers,
            failed_rules=policy_eval.failed_rules,
        )

        await self._persist_finalization(session_id, profile, bureau, risk, decision, offers)
        await self._audit.append(
            session_id, AuditEventType.DECISION_MADE.value, decision.model_dump(mode="json")
        )
        await self._audit.append(
            session_id, AuditEventType.SESSION_COMPLETED.value, {}
        )
        return decision

    async def _persist_transcript(
        self, session_id: UUID, segments: Sequence[TranscriptSegment]
    ) -> None:
        async with session_scope() as db:
            stmt = (
                select(TranscriptRecord.seq)
                .where(TranscriptRecord.session_id == session_id)
                .order_by(TranscriptRecord.seq.desc())
                .limit(1)
            )
            last = (await db.execute(stmt)).scalar()
            next_seq = (last or 0) + 1
            for seg in segments:
                db.add(
                    TranscriptRecord(
                        session_id=session_id,
                        seq=next_seq,
                        start_s=seg.start,
                        end_s=seg.end,
                        text=seg.text,
                        speaker=seg.speaker,
                        confidence=seg.confidence,
                    )
                )
                next_seq += 1

    async def _load_transcript(self, session_id: UUID) -> List[TranscriptSegment]:
        async with session_scope() as db:
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

    async def _load_age_estimation(self, session_id: UUID) -> Optional[AgeEstimation]:
        async with session_scope() as db:
            sess = await self._must_load(db, session_id)
            if not sess.age_estimation:
                return None
            try:
                return AgeEstimation.model_validate(sess.age_estimation)
            except Exception:
                return None

    async def _derive_customer_ref(self, session_id: UUID) -> str:
        async with session_scope() as db:
            sess = await self._must_load(db, session_id)
            return sess.customer_msisdn or sess.customer_email or str(sess.id)

    async def _persist_finalization(
        self,
        session_id: UUID,
        profile: ExtractedCustomerProfile,
        bureau,
        risk,
        decision: DecisionResult,
        offers: List[LoanOffer],
    ) -> None:
        async with session_scope() as db:
            sess = await self._must_load(db, session_id)
            sess.extracted_profile = profile.model_dump(mode="json")
            sess.bureau_snapshot = bureau.model_dump(mode="json")
            sess.risk_assessment = risk.model_dump(mode="json")
            sess.decision = decision.model_dump(mode="json")
            sess.status = (
                SessionStatus.COMPLETED.value
                if decision.outcome != DecisionOutcome.REJECTED
                else SessionStatus.REJECTED.value
            )
            sess.updated_at = datetime.utcnow()
            for off in offers:
                db.add(
                    Offer(
                        session_id=session_id,
                        offer_ref=off.offer_id,
                        principal_amount=off.principal_amount,
                        tenure_months=off.tenure_months,
                        interest_rate_pa=off.interest_rate_pa,
                        monthly_emi=off.monthly_emi,
                        processing_fee=off.processing_fee,
                        total_payable=off.total_payable,
                        expires_at=off.expires_at,
                    )
                )

    @staticmethod
    def _decide(
        policy_passed: bool, band: RiskBand, offers: List[LoanOffer]
    ) -> DecisionOutcome:
        if not policy_passed or band == RiskBand.REJECT or not offers:
            return DecisionOutcome.REJECTED
        if band == RiskBand.HIGH:
            return DecisionOutcome.MANUAL_REVIEW
        return DecisionOutcome.APPROVED

    @staticmethod
    def _explain(profile, bureau, risk, policy_eval, offers) -> str:
        if policy_eval.failed_rules:
            return "Policy failed: " + "; ".join(policy_eval.failed_rules)
        if not offers:
            return f"No eligible offers for risk band {risk.risk_band.value}."
        return (
            f"Customer placed in {risk.risk_band.value} risk band "
            f"(risk={risk.risk_score:.2f}, propensity={risk.propensity_score:.2f}). "
            f"Generated {len(offers)} offer(s)."
        )

    @staticmethod
    async def _must_load(db, session_id: UUID) -> LoanSession:
        sess = await db.get(LoanSession, session_id)
        if sess is None:
            raise NotFoundError(f"Session {session_id} not found")
        return sess
