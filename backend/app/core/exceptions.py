"""Domain-level exceptions.

Exceptions inherit from `LoanWizardError` so the API layer can map them to
HTTP responses in one place. This keeps services free of HTTP concerns
(Single Responsibility) and makes errors meaningful at the domain level.
"""
from __future__ import annotations


class LoanWizardError(Exception):
    """Base for all domain errors."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, code: str | None = None):
        super().__init__(message)
        if code:
            self.code = code


class NotFoundError(LoanWizardError):
    status_code = 404
    code = "not_found"


class ValidationError(LoanWizardError):
    status_code = 422
    code = "validation_error"


class PolicyViolationError(LoanWizardError):
    status_code = 409
    code = "policy_violation"


class ConsentMissingError(LoanWizardError):
    status_code = 403
    code = "consent_missing"


class FraudSignalError(LoanWizardError):
    status_code = 403
    code = "fraud_signal"


class UpstreamServiceError(LoanWizardError):
    status_code = 502
    code = "upstream_error"
