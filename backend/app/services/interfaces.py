"""Abstract interfaces for all pluggable services.

These exist to satisfy the **Dependency Inversion Principle**: high-level
orchestration code depends on these abstractions, never on concrete
implementations. Swapping faster-whisper for a cloud STT, or Ollama for
OpenAI, is a one-line wiring change in `dependencies.py`.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional, Sequence
from uuid import UUID

from app.schemas.domain import (
    AgeEstimation,
    BureauRecord,
    DecisionResult,
    ExtractedCustomerProfile,
    GeoLocation,
    LivenessResult,
    LoanOffer,
    PolicyEvaluation,
    RiskAssessment,
    TranscriptSegment,
)


class ISpeechToText(ABC):
    """Convert raw audio bytes to transcript segments."""

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        sample_rate: int = 16000,
        language: Optional[str] = None,
    ) -> List[TranscriptSegment]: ...


class IAgeEstimator(ABC):
    """Estimate age from one or more face images."""

    @abstractmethod
    async def estimate(self, image_bytes_list: Sequence[bytes]) -> AgeEstimation: ...


class ILivenessChecker(ABC):
    """Detect whether the subject is a live person, not a spoof."""

    @abstractmethod
    async def check(self, image_bytes_list: Sequence[bytes]) -> LivenessResult: ...


class ILLMClient(ABC):
    """Generic chat-completion + structured extraction interface."""

    @abstractmethod
    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        temperature: float = 0.2,
    ) -> str: ...

    @abstractmethod
    async def extract_profile(
        self, transcript_segments: Sequence[TranscriptSegment]
    ) -> ExtractedCustomerProfile: ...


class IBureauProvider(ABC):
    """Fetch internal/external bureau data for a customer."""

    @abstractmethod
    async def fetch(self, customer_ref: str) -> BureauRecord: ...


class IRiskScorer(ABC):
    """Compute risk + propensity scores from profile + bureau data."""

    @abstractmethod
    def score(
        self,
        profile: ExtractedCustomerProfile,
        bureau: BureauRecord,
    ) -> RiskAssessment: ...


class IPolicyEngine(ABC):
    """Apply deterministic policy rules; never overridden by LLM."""

    @abstractmethod
    def evaluate(
        self,
        profile: ExtractedCustomerProfile,
        bureau: BureauRecord,
        risk: RiskAssessment,
        age_estimation: Optional[AgeEstimation] = None,
    ) -> PolicyEvaluation: ...


class IOfferGenerator(ABC):
    """Generate one or more personalized loan offers."""

    @abstractmethod
    def generate(
        self,
        profile: ExtractedCustomerProfile,
        bureau: BureauRecord,
        risk: RiskAssessment,
    ) -> List[LoanOffer]: ...


class IGeoValidator(ABC):
    """Validate geo-location and detect fraud signals (mismatch, VPN, etc.)."""

    @abstractmethod
    async def validate(self, geo: GeoLocation, declared_pincode: Optional[str]) -> List[str]: ...


class IObjectStorage(ABC):
    """Upload/download blobs (video chunks, audio, snapshots)."""

    @abstractmethod
    async def put(self, key: str, data: bytes, content_type: str) -> str: ...

    @abstractmethod
    async def get(self, key: str) -> bytes: ...


class IAuditRepository(ABC):
    """Append-only audit log of every meaningful event in a session."""

    @abstractmethod
    async def append(
        self,
        session_id: UUID,
        event_type: str,
        payload: dict,
    ) -> None: ...

    @abstractmethod
    async def list_for_session(self, session_id: UUID) -> List[dict]: ...
