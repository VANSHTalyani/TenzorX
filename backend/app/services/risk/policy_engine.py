"""Deterministic policy engine.

Each rule is a small callable class implementing `IPolicyRule` so new rules
can be added without modifying the engine — **Open/Closed Principle**.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

from app.core.config import get_settings
from app.schemas.domain import (
    AgeEstimation,
    BureauRecord,
    ExtractedCustomerProfile,
    PolicyEvaluation,
    RiskAssessment,
)
from app.schemas.enums import RiskBand
from app.services.interfaces import IPolicyEngine


@dataclass
class RuleContext:
    profile: ExtractedCustomerProfile
    bureau: BureauRecord
    risk: RiskAssessment
    age_estimation: Optional[AgeEstimation]


class IPolicyRule(ABC):
    code: str

    @abstractmethod
    def check(self, ctx: RuleContext) -> Optional[str]:
        """Return None if rule passes; an explanation string if it fails."""


class MinAgeRule(IPolicyRule):
    code = "min_age"

    def __init__(self, min_age: int) -> None:
        self._min = min_age

    def check(self, ctx: RuleContext) -> Optional[str]:
        age = ctx.profile.declared_age or (ctx.age_estimation.estimated_age if ctx.age_estimation else None)
        if age is None:
            return None
        if age < self._min:
            return f"Age {age} below minimum {self._min}"
        return None


class MaxAgeRule(IPolicyRule):
    code = "max_age"

    def __init__(self, max_age: int) -> None:
        self._max = max_age

    def check(self, ctx: RuleContext) -> Optional[str]:
        age = ctx.profile.declared_age or (ctx.age_estimation.estimated_age if ctx.age_estimation else None)
        if age is None:
            return None
        if age > self._max:
            return f"Age {age} above maximum {self._max}"
        return None


class AgeConsistencyRule(IPolicyRule):
    """Detect mismatch between declared age and CV-estimated age."""

    code = "age_consistency"

    def __init__(self, tolerance_years: int) -> None:
        self._tol = tolerance_years

    def check(self, ctx: RuleContext) -> Optional[str]:
        if ctx.profile.declared_age is None or ctx.age_estimation is None:
            return None
        if ctx.age_estimation.confidence < 0.3:
            return None
        diff = abs(ctx.profile.declared_age - ctx.age_estimation.estimated_age)
        if diff > self._tol:
            return f"Declared age {ctx.profile.declared_age} differs from estimated {ctx.age_estimation.estimated_age} by {diff} years"
        return None


class MinIncomeRule(IPolicyRule):
    code = "min_income"

    def __init__(self, min_monthly: int) -> None:
        self._min = min_monthly

    def check(self, ctx: RuleContext) -> Optional[str]:
        if ctx.profile.monthly_income is None:
            return None
        if ctx.profile.monthly_income < self._min:
            return f"Monthly income {ctx.profile.monthly_income:.0f} below minimum {self._min}"
        return None


class RiskBandRule(IPolicyRule):
    code = "risk_band"

    def check(self, ctx: RuleContext) -> Optional[str]:
        if ctx.risk.risk_band == RiskBand.REJECT:
            return f"Risk band REJECT (score={ctx.risk.risk_score:.2f})"
        return None


class OverdueRule(IPolicyRule):
    code = "overdue"

    def __init__(self, max_overdue: int = 2) -> None:
        self._max = max_overdue

    def check(self, ctx: RuleContext) -> Optional[str]:
        if ctx.bureau.overdue_count > self._max:
            return f"{ctx.bureau.overdue_count} overdue accounts exceed allowed {self._max}"
        return None


class PolicyEngine(IPolicyEngine):
    """Compose rules; high-level engine never knows individual rule logic."""

    def __init__(self, rules: Optional[List[IPolicyRule]] = None) -> None:
        s = get_settings()
        self._rules: List[IPolicyRule] = rules or [
            MinAgeRule(s.policy_min_age),
            MaxAgeRule(s.policy_max_age),
            AgeConsistencyRule(s.vision_age_tolerance_years),
            MinIncomeRule(s.policy_min_income_monthly),
            RiskBandRule(),
            OverdueRule(),
        ]

    def add_rule(self, rule: IPolicyRule) -> None:
        self._rules.append(rule)

    def evaluate(
        self,
        profile: ExtractedCustomerProfile,
        bureau: BureauRecord,
        risk: RiskAssessment,
        age_estimation: Optional[AgeEstimation] = None,
    ) -> PolicyEvaluation:
        ctx = RuleContext(
            profile=profile,
            bureau=bureau,
            risk=risk,
            age_estimation=age_estimation,
        )
        failed: List[str] = []
        warnings: List[str] = []
        for rule in self._rules:
            try:
                msg = rule.check(ctx)
                if msg:
                    failed.append(f"[{rule.code}] {msg}")
            except Exception as exc:
                warnings.append(f"[{rule.code}] error: {exc}")
        return PolicyEvaluation(passed=len(failed) == 0, failed_rules=failed, warnings=warnings)
