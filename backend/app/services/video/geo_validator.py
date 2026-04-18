"""Heuristic geo-location validator.

Detects:
- impossible coordinates
- coordinates outside India bounding box (campaign rule for this NBFC)
- low-accuracy or missing fixes (likely VPN / spoofed)

Plug a real reverse-geocoder + IP intel here in production.
"""
from __future__ import annotations

from typing import List, Optional

from app.schemas.domain import GeoLocation
from app.services.interfaces import IGeoValidator


_INDIA_BBOX = (6.5, 35.5, 68.0, 97.5)  # lat_min, lat_max, lon_min, lon_max


class HeuristicGeoValidator(IGeoValidator):
    async def validate(self, geo: GeoLocation, declared_pincode: Optional[str]) -> List[str]:
        signals: List[str] = []
        if not (-90.0 <= geo.latitude <= 90.0 and -180.0 <= geo.longitude <= 180.0):
            signals.append("invalid_coordinates")
            return signals

        lat_min, lat_max, lon_min, lon_max = _INDIA_BBOX
        if not (lat_min <= geo.latitude <= lat_max and lon_min <= geo.longitude <= lon_max):
            signals.append("outside_serviceable_region")

        if geo.accuracy_m is None or geo.accuracy_m > 5000:
            signals.append("low_accuracy_fix")

        return signals
