"""Pydantic schemas representing domain objects.

These schemas form the contract between layers. Services accept and return
schemas (not ORM models) so they remain decoupled from persistence.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import (
    ConsentType,
    DecisionOutcome,
    EmploymentType,
    LoanPurpose,
    RiskBand,
    SessionStatus,
)


class GeoLocation(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = None
    source: str = "browser"
    captured_at: datetime = Field(default_factory=datetime.utcnow)


class DeviceMetadata(BaseModel):
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    platform: Optional[str] = None
    screen_resolution: Optional[str] = None


class CampaignContext(BaseModel):
    campaign_id: str
    channel: str
    referral_token: Optional[str] = None


class SessionCreateRequest(BaseModel):
    campaign: CampaignContext
    customer_msisdn: Optional[str] = Field(default=None, description="Phone number")
    customer_email: Optional[str] = None


class SessionView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: SessionStatus
    created_at: datetime
    campaign_id: str
    customer_msisdn: Optional[str] = None


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    speaker: str = "customer"
    confidence: Optional[float] = None


class TranscriptUpdate(BaseModel):
    session_id: UUID
    segments: List[TranscriptSegment]


class ExtractedCustomerProfile(BaseModel):
    """Structured profile extracted from transcript by the LLM."""

    full_name: Optional[str] = None
    declared_age: Optional[int] = None
    employment_type: EmploymentType = EmploymentType.UNKNOWN
    employer_name: Optional[str] = None
    monthly_income: Optional[float] = None
    loan_amount_requested: Optional[float] = None
    loan_purpose: LoanPurpose = LoanPurpose.OTHER
    tenure_months_requested: Optional[int] = None
    existing_emi_total: Optional[float] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    confidence: float = 0.0
    notes: Optional[str] = None


class ConsentRecord(BaseModel):
    consent_type: ConsentType
    granted: bool
    transcript_excerpt: Optional[str] = None
    captured_at: datetime = Field(default_factory=datetime.utcnow)


class AgeEstimation(BaseModel):
    estimated_age: int
    confidence: float
    frames_analyzed: int


class LivenessResult(BaseModel):
    is_live: bool
    confidence: float
    signals: dict


class BureauRecord(BaseModel):
    customer_ref: str
    cibil_score: Optional[int] = None
    active_loans: int = 0
    total_outstanding: float = 0.0
    overdue_count: int = 0
    inquiries_last_6m: int = 0
    oldest_account_months: int = 0


class RiskAssessment(BaseModel):
    risk_score: float = Field(ge=0.0, le=1.0)
    risk_band: RiskBand
    propensity_score: float = Field(ge=0.0, le=1.0)
    drivers: List[str] = Field(default_factory=list)


class PolicyEvaluation(BaseModel):
    passed: bool
    failed_rules: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class LoanOffer(BaseModel):
    offer_id: str
    principal_amount: float
    tenure_months: int
    interest_rate_pa: float
    monthly_emi: float
    processing_fee: float
    total_payable: float
    expires_at: datetime


class DecisionResult(BaseModel):
    outcome: DecisionOutcome
    risk_band: RiskBand
    explanation: str
    offers: List[LoanOffer] = Field(default_factory=list)
    failed_rules: List[str] = Field(default_factory=list)


class FraudSignal(BaseModel):
    kind: str
    severity: str
    detail: str
