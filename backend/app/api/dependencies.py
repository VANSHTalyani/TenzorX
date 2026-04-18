"""Composition root.

This is the ONE place where concrete service classes are constructed and
wired together. All other modules depend on the abstract interfaces.
Swapping an implementation (e.g. a different STT backend) requires only a
change here.
"""
from __future__ import annotations

from functools import lru_cache

from app.services.audit import SqlAuditRepository
from app.services.llm import OllamaLLMClient
from app.services.offer import RuleBasedOfferGenerator
from app.services.risk import HybridRiskScorer, PolicyEngine, SyntheticBureauProvider
from app.services.session_orchestrator import SessionOrchestrator
from app.services.stt import FasterWhisperSTT
from app.services.video import HeuristicGeoValidator
from app.services.vision import DeepFaceAgeEstimator, MediaPipeLivenessChecker


@lru_cache(maxsize=1)
def get_orchestrator() -> SessionOrchestrator:
    return SessionOrchestrator(
        stt=FasterWhisperSTT(),
        age_estimator=DeepFaceAgeEstimator(),
        liveness=MediaPipeLivenessChecker(),
        llm=OllamaLLMClient(),
        bureau=SyntheticBureauProvider(),
        risk=HybridRiskScorer(),
        policy=PolicyEngine(),
        offers=RuleBasedOfferGenerator(),
        geo=HeuristicGeoValidator(),
        audit=SqlAuditRepository(),
    )


@lru_cache(maxsize=1)
def get_audit_repository() -> SqlAuditRepository:
    return SqlAuditRepository()
