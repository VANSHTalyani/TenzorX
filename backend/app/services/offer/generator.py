"""Rule-based offer generator.

Generates 1–3 offers personalized by risk band, income, and the customer's
requested amount/tenure. EMI is calculated using the standard reducing
balance formula.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import List

from app.core.config import get_settings
from app.schemas.domain import (
    BureauRecord,
    ExtractedCustomerProfile,
    LoanOffer,
    RiskAssessment,
)
from app.schemas.enums import RiskBand
from app.services.interfaces import IOfferGenerator


_RATE_TABLE = {
    RiskBand.LOW: 0.115,
    RiskBand.MEDIUM: 0.145,
    RiskBand.HIGH: 0.185,
    RiskBand.REJECT: 0.260,
}

_AMOUNT_MULTIPLIER = {
    RiskBand.LOW: 18,
    RiskBand.MEDIUM: 12,
    RiskBand.HIGH: 6,
    RiskBand.REJECT: 0,
}


class RuleBasedOfferGenerator(IOfferGenerator):
    def __init__(self, offer_validity_hours: int = 72) -> None:
        self._validity = timedelta(hours=offer_validity_hours)
        self._settings = get_settings()

    def generate(
        self,
        profile: ExtractedCustomerProfile,
        bureau: BureauRecord,
        risk: RiskAssessment,
    ) -> List[LoanOffer]:
        if risk.risk_band == RiskBand.REJECT:
            return []

        income = profile.monthly_income or 0.0
        if income <= 0:
            return []

        max_eligible = min(
            income * _AMOUNT_MULTIPLIER[risk.risk_band],
            float(self._settings.policy_max_loan_amount),
        )
        max_eligible = max(max_eligible, float(self._settings.policy_min_loan_amount))

        requested = profile.loan_amount_requested or max_eligible
        principal_main = min(requested, max_eligible)
        if principal_main < self._settings.policy_min_loan_amount:
            return []

        rate = _RATE_TABLE[risk.risk_band]
        tenures = self._tenure_choices(profile.tenure_months_requested)

        offers: List[LoanOffer] = []
        for tenure in tenures:
            offers.append(self._build_offer(principal_main, tenure, rate))
        if principal_main < max_eligible * 0.95 and len(offers) < 3:
            offers.append(self._build_offer(max_eligible, tenures[1], rate))
        return offers

    @staticmethod
    def _tenure_choices(requested: int | None) -> List[int]:
        if requested:
            base = max(6, min(60, requested))
            return sorted({max(6, base - 12), base, min(60, base + 12)})
        return [12, 24, 36]

    def _build_offer(self, principal: float, tenure_months: int, annual_rate: float) -> LoanOffer:
        emi = self._emi(principal, annual_rate, tenure_months)
        processing = round(principal * 0.015, 2)
        return LoanOffer(
            offer_id=f"OFFER-{uuid.uuid4().hex[:10].upper()}",
            principal_amount=round(principal, 2),
            tenure_months=tenure_months,
            interest_rate_pa=round(annual_rate * 100, 2),
            monthly_emi=round(emi, 2),
            processing_fee=processing,
            total_payable=round(emi * tenure_months + processing, 2),
            expires_at=datetime.utcnow() + self._validity,
        )

    @staticmethod
    def _emi(principal: float, annual_rate: float, months: int) -> float:
        r = annual_rate / 12.0
        if r <= 0 or months <= 0:
            return principal / max(months, 1)
        return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)
