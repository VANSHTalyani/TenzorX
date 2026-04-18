"""Domain enums shared across services and API layers."""
from __future__ import annotations

from enum import Enum


class SessionStatus(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    ABANDONED = "abandoned"
    ERROR = "error"


class ConsentType(str, Enum):
    DATA_PROCESSING = "data_processing"
    VIDEO_RECORDING = "video_recording"
    BUREAU_PULL = "bureau_pull"
    LOAN_TERMS = "loan_terms"


class RiskBand(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    REJECT = "reject"


class DecisionOutcome(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_REVIEW = "manual_review"


class EmploymentType(str, Enum):
    SALARIED = "salaried"
    SELF_EMPLOYED = "self_employed"
    BUSINESS = "business"
    RETIRED = "retired"
    UNEMPLOYED = "unemployed"
    UNKNOWN = "unknown"


class LoanPurpose(str, Enum):
    PERSONAL = "personal"
    HOME = "home"
    EDUCATION = "education"
    MEDICAL = "medical"
    BUSINESS = "business"
    DEBT_CONSOLIDATION = "debt_consolidation"
    VEHICLE = "vehicle"
    OTHER = "other"


class AuditEventType(str, Enum):
    SESSION_STARTED = "session_started"
    CONSENT_CAPTURED = "consent_captured"
    TRANSCRIPT_APPENDED = "transcript_appended"
    AGE_ESTIMATED = "age_estimated"
    LIVENESS_CHECKED = "liveness_checked"
    GEO_CAPTURED = "geo_captured"
    LLM_EXTRACTION = "llm_extraction"
    RISK_EVALUATED = "risk_evaluated"
    POLICY_EVALUATED = "policy_evaluated"
    OFFER_GENERATED = "offer_generated"
    DECISION_MADE = "decision_made"
    SESSION_COMPLETED = "session_completed"
    FRAUD_SIGNAL = "fraud_signal"
    ERROR = "error"
