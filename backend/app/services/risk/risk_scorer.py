"""Hybrid risk scorer.

Combines an interpretable rule-based base score with an XGBoost propensity
model when one is available on disk. Falls back to a pure-rules score if the
ML model file isn't present, so the system always works.
"""
from __future__ import annotations

import json
import os
from typing import List

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.domain import (
    BureauRecord,
    ExtractedCustomerProfile,
    RiskAssessment,
)
from app.schemas.enums import RiskBand
from app.services.interfaces import IRiskScorer

log = get_logger(__name__)


class HybridRiskScorer(IRiskScorer):
    def __init__(self) -> None:
        self._settings = get_settings()
        self._model = None
        self._features: list[str] = []
        self._try_load_model()

    def _try_load_model(self) -> None:
        path = self._settings.risk_model_path
        feat_path = self._settings.risk_model_features_path
        if not (os.path.exists(path) and os.path.exists(feat_path)):
            log.info("risk.model.not_found", path=path)
            return
        try:
            import xgboost as xgb

            booster = xgb.Booster()
            booster.load_model(path)
            with open(feat_path, "r", encoding="utf-8") as fh:
                self._features = json.load(fh)
            self._model = booster
            log.info("risk.model.loaded", features=len(self._features))
        except Exception as exc:
            log.warning("risk.model.load_failed", error=str(exc))

    def score(
        self,
        profile: ExtractedCustomerProfile,
        bureau: BureauRecord,
    ) -> RiskAssessment:
        base, drivers = self._rule_score(profile, bureau)
        propensity = self._ml_score(profile, bureau) if self._model else (1.0 - base)

        risk_score = max(0.0, min(1.0, 0.7 * base + 0.3 * (1.0 - propensity)))
        band = self._band(risk_score)
        return RiskAssessment(
            risk_score=round(risk_score, 4),
            risk_band=band,
            propensity_score=round(propensity, 4),
            drivers=drivers,
        )

    @staticmethod
    def _rule_score(
        profile: ExtractedCustomerProfile, bureau: BureauRecord
    ) -> tuple[float, List[str]]:
        score = 0.5
        drivers: List[str] = []

        if bureau.cibil_score is not None:
            if bureau.cibil_score >= 750:
                score -= 0.25
                drivers.append("strong_cibil")
            elif bureau.cibil_score >= 700:
                score -= 0.10
                drivers.append("good_cibil")
            elif bureau.cibil_score < 650:
                score += 0.20
                drivers.append("weak_cibil")

        if bureau.overdue_count > 0:
            score += 0.15
            drivers.append(f"overdue_{bureau.overdue_count}")
        if bureau.inquiries_last_6m > 5:
            score += 0.10
            drivers.append("high_inquiry_velocity")
        if bureau.oldest_account_months > 36:
            score -= 0.05
            drivers.append("seasoned_history")

        if profile.monthly_income and profile.loan_amount_requested and profile.tenure_months_requested:
            est_emi = profile.loan_amount_requested / max(profile.tenure_months_requested, 1)
            existing = profile.existing_emi_total or 0.0
            foir = (est_emi + existing) / max(profile.monthly_income, 1)
            if foir > 0.55:
                score += 0.20
                drivers.append("high_foir")
            elif foir < 0.30:
                score -= 0.10
                drivers.append("low_foir")

        if profile.employment_type.value in {"unemployed", "unknown"}:
            score += 0.15
            drivers.append("unverified_employment")

        return max(0.0, min(1.0, score)), drivers

    def _ml_score(
        self, profile: ExtractedCustomerProfile, bureau: BureauRecord
    ) -> float:
        try:
            import numpy as np
            import xgboost as xgb

            row = {
                "cibil_score": bureau.cibil_score or 650,
                "active_loans": bureau.active_loans,
                "total_outstanding": bureau.total_outstanding,
                "overdue_count": bureau.overdue_count,
                "inquiries_last_6m": bureau.inquiries_last_6m,
                "oldest_account_months": bureau.oldest_account_months,
                "monthly_income": profile.monthly_income or 0.0,
                "loan_amount_requested": profile.loan_amount_requested or 0.0,
                "tenure_months_requested": profile.tenure_months_requested or 0,
                "existing_emi_total": profile.existing_emi_total or 0.0,
                "is_salaried": 1 if profile.employment_type.value == "salaried" else 0,
            }
            vec = np.array([[row.get(f, 0.0) for f in self._features]], dtype=float)
            d = xgb.DMatrix(vec, feature_names=self._features)
            pred = float(self._model.predict(d)[0])
            return max(0.0, min(1.0, pred))
        except Exception as exc:
            log.warning("risk.ml.score_failed", error=str(exc))
            return 0.5

    @staticmethod
    def _band(risk: float) -> RiskBand:
        if risk < 0.30:
            return RiskBand.LOW
        if risk < 0.55:
            return RiskBand.MEDIUM
        if risk < 0.80:
            return RiskBand.HIGH
        return RiskBand.REJECT
