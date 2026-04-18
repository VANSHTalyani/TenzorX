"""Lightweight liveness check using MediaPipe FaceMesh.

This is a basic motion + landmark variance heuristic suitable for a free
tier. For real-world deployment, plug in a passive liveness model (e.g.
FaceTec, Onfido) by implementing `ILivenessChecker` and swapping the
binding in `dependencies.py`.
"""
from __future__ import annotations

import asyncio
import io
from typing import List, Sequence

import numpy as np
from PIL import Image

from app.core.logging import get_logger
from app.schemas.domain import LivenessResult
from app.services.interfaces import ILivenessChecker

log = get_logger(__name__)


class MediaPipeLivenessChecker(ILivenessChecker):
    """Compute landmark movement across frames as a liveness signal."""

    def __init__(self, min_frames: int = 3, motion_threshold: float = 0.005) -> None:
        self._min_frames = min_frames
        self._motion_threshold = motion_threshold

    async def check(self, image_bytes_list: Sequence[bytes]) -> LivenessResult:
        if len(image_bytes_list) < self._min_frames:
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                signals={"reason": "insufficient_frames"},
            )

        landmarks_per_frame = await asyncio.to_thread(
            self._extract_landmarks, list(image_bytes_list)
        )
        valid = [lm for lm in landmarks_per_frame if lm is not None]
        if len(valid) < self._min_frames:
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                signals={"reason": "no_face_detected", "valid_frames": len(valid)},
            )

        motion = float(np.mean([np.linalg.norm(valid[i] - valid[i - 1]) for i in range(1, len(valid))]))
        is_live = motion >= self._motion_threshold
        confidence = float(min(1.0, motion / (self._motion_threshold * 4)))
        return LivenessResult(
            is_live=is_live,
            confidence=confidence,
            signals={"motion_score": motion, "frames_used": len(valid)},
        )

    def _extract_landmarks(self, blobs: List[bytes]):
        import mediapipe as mp

        mp_face = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5,
        )
        results = []
        try:
            for blob in blobs:
                try:
                    img = Image.open(io.BytesIO(blob)).convert("RGB")
                    arr = np.array(img)
                    out = mp_face.process(arr)
                    if out.multi_face_landmarks:
                        lm = out.multi_face_landmarks[0]
                        coords = np.array([[p.x, p.y, p.z] for p in lm.landmark], dtype=np.float32)
                        results.append(coords.flatten())
                    else:
                        results.append(None)
                except Exception as exc:
                    log.warning("vision.liveness.frame_failed", error=str(exc))
                    results.append(None)
        finally:
            mp_face.close()
        return results
