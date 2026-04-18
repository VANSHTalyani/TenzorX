"""Campaign endpoints — generate the secure entry link customers click."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


class CampaignLinkRequest(BaseModel):
    campaign_id: str
    channel: str = "whatsapp"
    customer_msisdn: str | None = None
    customer_email: str | None = None
    base_url: str = "http://localhost:3000"


class CampaignLinkResponse(BaseModel):
    url: str
    token: str
    expires_at: datetime


@router.post("/links", response_model=CampaignLinkResponse)
async def create_link(req: CampaignLinkRequest) -> CampaignLinkResponse:
    token = secrets.token_urlsafe(24)
    expires = datetime.utcnow() + timedelta(hours=24)
    url = (
        f"{req.base_url.rstrip('/')}/onboard"
        f"?campaign={req.campaign_id}&channel={req.channel}&token={token}"
    )
    return CampaignLinkResponse(url=url, token=token, expires_at=expires)
