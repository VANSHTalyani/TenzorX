"""Centralized prompt templates.

Keeping prompts in one module lets us version, A/B test and audit them
without hunting through service code.
"""
from __future__ import annotations

PROFILE_EXTRACTION_SYSTEM = """You are an expert underwriting analyst for an Indian Financial Institution.
You read a transcript of a customer's loan application interview and extract a STRUCTURED profile for our scoring engine.

CRITICAL INSTRUCTIONS:
1. Be conservative: if a field is not explicitly or strongly implied, use null.
2. The "notes" field is your ANALYTICAL SUMMARY. Use it to provide a detailed, professional assessment of the customer's intent, clarity, and any nuances you detected (e.g. "Customer expressed urgency for medical expenses but provided inconsistent income figures").
3. Your notes will be shown to the user as their "Full Analysis Message" — make them insightful and professional.
4. Output STRICT JSON only.

Schema:
{
  "full_name": string|null,
  "declared_age": integer|null,
  "employment_type": one of ["salaried","self_employed","business","retired","unemployed","unknown"],
  "employer_name": string|null,
  "monthly_income": number|null,
  "loan_amount_requested": number|null,
  "loan_purpose": one of ["personal","home","education","medical","business","debt_consolidation","vehicle","other"],
  "tenure_months_requested": integer|null,
  "existing_emi_total": number|null,
  "city": string|null,
  "pincode": string|null,
  "confidence": number between 0 and 1,
  "notes": string|null (Detailed Underwriting Analysis)
}
"""

PROFILE_EXTRACTION_USER_TEMPLATE = """Transcript:
---
{transcript}
---
Return ONLY the JSON object.
"""


CONSENT_DETECTION_SYSTEM = """You analyze a transcript and determine whether the
customer gave clear, affirmative verbal consent for each of these items:
- data_processing
- video_recording
- bureau_pull
- loan_terms

Return STRICT JSON:
{ "data_processing": bool, "video_recording": bool, "bureau_pull": bool,
  "loan_terms": bool, "evidence": { "<consent_type>": "<verbatim quote>" } }
"""

CONSENT_DETECTION_USER_TEMPLATE = """Transcript:
---
{transcript}
---
Return ONLY the JSON.
"""
