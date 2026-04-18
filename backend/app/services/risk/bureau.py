"""Bureau provider — replace with CIBIL/Experian client in production.

For the free tier we deterministically generate plausible bureau records
from a hash of the customer reference, so the demo behaves consistently
without paid API calls.
"""
from __future__ import annotations

import hashlib

from app.schemas.domain import BureauRecord
from app.services.interfaces import IBureauProvider


class SyntheticBureauProvider(IBureauProvider):
    async def fetch(self, customer_ref: str) -> BureauRecord:
        h = hashlib.sha256((customer_ref or "anon").encode()).digest()

        cibil = 600 + (h[0] % 251)
        active = h[1] % 5
        outstanding = float((h[2] * 1000) + (h[3] * 50))
        overdue = h[4] % 4
        inquiries = h[5] % 8
        oldest = 6 + (h[6] % 120)

        return BureauRecord(
            customer_ref=customer_ref or "anon",
            cibil_score=cibil,
            active_loans=active,
            total_outstanding=outstanding,
            overdue_count=overdue,
            inquiries_last_6m=inquiries,
            oldest_account_months=oldest,
        )
