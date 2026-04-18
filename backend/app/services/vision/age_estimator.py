"""Age estimation via DeepFace (free, local).

Aggregates predictions across frames using a robust median + a confidence
score derived from inter-frame variance. The interface is async-friendly:
heavy work runs in a thread pool so it never blocks the event loop.
"""
from __future__ import annotations

import asyncio
import io
from statistics import median, pstdev
from typing import List, Sequence

import numpy as np
from PIL import Image

from app.core.logging import get_logger
from app.schemas.domain import AgeEstimation
from app.services.interfaces import IAgeEstimator

log = get_logger(__name__)


class DeepFaceAgeEstimator(IAgeEstimator):
    """Estimate age from face images using DeepFace's analyze pipeline."""

    def __init__(self, detector_backend: str = "opencv") -> None:
        self._detector_backend = detector_backend

    async def estimate(self, image_bytes_list: Sequence[bytes]) -> AgeEstimation:
        if not image_bytes_list:
            return AgeEstimation(estimated_age=0, confidence=0.0, frames_analyzed=0)

        ages = await asyncio.to_thread(self._analyze_batch, list(image_bytes_list))
        if not ages:
            return AgeEstimation(estimated_age=0, confidence=0.0, frames_analyzed=0)

        med = float(median(ages))
        spread = float(pstdev(ages)) if len(ages) > 1 else 0.0
        confidence = max(0.0, min(1.0, 1.0 - (spread / 15.0)))
        return AgeEstimation(
            estimated_age=int(round(med)),
            confidence=confidence,
            frames_analyzed=len(ages),
        )

    def _analyze_batch(self, blobs: List[bytes]) -> List[float]:
        from deepface import DeepFace

        ages: List[float] = []
        for blob in blobs:
            try:
                img = Image.open(io.BytesIO(blob)).convert("RGB")
                arr = np.array(img)
                result = DeepFace.analyze(
                    img_path=arr,
                    actions=["age"],
                    enforce_detection=False,
                    detector_backend=self._detector_backend,
                    silent=True,
                )
                if isinstance(result, list) and result:
                    result = result[0]
                if isinstance(result, dict) and "age" in result:
                    ages.append(float(result["age"]))
            except Exception as exc:
                log.warning("vision.age.frame_failed", error=str(exc))
                continue
        return ages
