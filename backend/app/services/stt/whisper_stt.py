"""faster-whisper based implementation of `ISpeechToText`.

Decoding strategy: **soundfile** (WAV/FLAC) → **ffmpeg** (robust for fragmented
WebM/Opus from browsers) → **PyAV** last resort. MediaRecorder chunks are often
not a complete Matroska file; PyAV frequently raises ``InvalidDataError`` on
those blobs — ffmpeg tolerates them much better.

Concurrency: a semaphore caps parallel ``transcribe`` calls. Per-session
transcript persistence is serialized in ``SessionOrchestrator.ingest_audio``.

Segments are **fully collected inside the worker thread** (Whisper returns a
lazy generator). Long single-segment replies are also split on ``. ? !``
sentence boundaries so multiple transcript rows appear in the UI.
"""
from __future__ import annotations

import asyncio
import io
import re
import subprocess
from typing import Any, List, Optional, Sequence

import numpy as np
import soundfile as sf

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.domain import TranscriptSegment
from app.services.interfaces import ISpeechToText

log = get_logger(__name__)

# Ignore tiny / empty uploads (keep-alive chunks, truncated blobs).
_MIN_INPUT_BYTES = 64
# ~150 ms at 16 kHz — below this Whisper adds little value and often hallucinates.
_MIN_PCM_SAMPLES = 2400


def _is_webm_header(data: bytes) -> bool:
    return len(data) >= 4 and data[:4] == b"\x1a\x45\xdf\xa3"


def _decode_via_ffmpeg(audio_bytes: bytes, target_sr: int) -> Optional[np.ndarray]:
    """Decode arbitrary media to mono float32 PCM using ffmpeg (stdin → stdout)."""
    if len(audio_bytes) < _MIN_INPUT_BYTES:
        return None

    out_suffix = [
        "-vn",
        "-f",
        "f32le",
        "-ac",
        "1",
        "-ar",
        str(target_sr),
        "pipe:1",
    ]
    # Auto-detect, then common browser containers (fragmented WebM / Safari MP4).
    attempts: list[list[str]] = [
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            *out_suffix,
        ],
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "webm",
            "-i",
            "pipe:0",
            *out_suffix,
        ],
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "mp4",
            "-i",
            "pipe:0",
            *out_suffix,
        ],
    ]

    for cmd in attempts:
        try:
            proc = subprocess.run(
                cmd,
                input=audio_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=120,
                check=False,
            )
        except FileNotFoundError:
            log.warning("stt.decode.ffmpeg_missing", detail="install ffmpeg in PATH")
            return None
        except subprocess.TimeoutExpired:
            log.warning("stt.decode.ffmpeg_timeout")
            continue
        except Exception as exc:
            log.warning("stt.decode.ffmpeg_exception", error=str(exc))
            continue

        if proc.returncode != 0:
            err = (proc.stderr or b"").decode("utf-8", errors="replace")[:400]
            log.debug(
                "stt.decode.ffmpeg_nonzero",
                returncode=proc.returncode,
                stderr=err,
            )
            continue
        if not proc.stdout:
            continue
        arr = np.frombuffer(proc.stdout, dtype=np.float32).copy()
        if arr.size > 0:
            return arr
    return None


def _decode_via_av(audio_bytes: bytes, target_sr: int) -> Optional[np.ndarray]:
    try:
        import av  # type: ignore
    except ImportError:
        return None
    try:
        container = av.open(io.BytesIO(audio_bytes), mode="r")
    except Exception as exc:
        log.debug("stt.decode.av_open_failed", error=str(exc))
        return None
    try:
        samples: list[np.ndarray] = []
        sr = target_sr
        for frame in container.decode(audio=0):
            arr = frame.to_ndarray()
            if arr.ndim == 2:
                arr = arr.mean(axis=0)
            samples.append(arr.astype(np.float32))
            sr = frame.sample_rate
        if not samples:
            return None
        data = np.concatenate(samples)
    finally:
        try:
            container.close()
        except Exception:
            pass

    if data.ndim == 2:
        data = data.mean(axis=1)
    if sr != target_sr and data.size > 0:
        ratio = target_sr / sr
        new_len = int(round(len(data) * ratio))
        data = np.interp(
            np.linspace(0, len(data), new_len, endpoint=False),
            np.arange(len(data)),
            data,
        ).astype(np.float32)
    return data


class FasterWhisperSTT(ISpeechToText):
    """Production-ready local STT using CTranslate2 backend (faster-whisper)."""

    def __init__(
        self,
        model_size: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        language: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self._model_size = model_size or settings.whisper_model_size
        self._device = device or settings.whisper_device
        self._compute_type = compute_type or settings.whisper_compute_type
        self._language = language or settings.whisper_language
        self._max_concurrent = max(1, settings.stt_max_concurrent)
        self._model = None
        self._model_lock = asyncio.Lock()
        self._infer_sem = asyncio.Semaphore(self._max_concurrent)

    async def _ensure_model(self):
        if self._model is not None:
            return self._model
        async with self._model_lock:
            if self._model is None:
                from faster_whisper import WhisperModel

                log.info(
                    "stt.model.load",
                    size=self._model_size,
                    device=self._device,
                    compute=self._compute_type,
                )
                self._model = await asyncio.to_thread(
                    WhisperModel,
                    self._model_size,
                    device=self._device,
                    compute_type=self._compute_type,
                )
        return self._model

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        sample_rate: int = 16000,
        language: Optional[str] = None,
    ) -> List[TranscriptSegment]:
        if not audio_bytes or len(audio_bytes) < _MIN_INPUT_BYTES:
            return []

        model = await self._ensure_model()
        audio = await asyncio.to_thread(self._decode_audio, audio_bytes, sample_rate)
        if audio.size < _MIN_PCM_SAMPLES:
            log.debug(
                "stt.skip_short_pcm",
                samples=int(audio.size),
                input_bytes=len(audio_bytes),
            )
            return []

        async with self._infer_sem:
            raw_segments: Sequence[Any] = await asyncio.to_thread(
                _transcribe_sync_collect,
                model,
                audio,
                language or self._language,
            )

        return _whisper_segments_to_transcript_rows(list(raw_segments))

    @staticmethod
    def _decode_audio(audio_bytes: bytes, target_sr: int) -> np.ndarray:
        """Decode arbitrary container to mono float32 PCM @ ``target_sr``."""
        if len(audio_bytes) < _MIN_INPUT_BYTES:
            return np.zeros(0, dtype=np.float32)

        # 1) WAV / FLAC / AIFF via soundfile (fast path).
        try:
            data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
            if data.ndim == 2:
                data = data.mean(axis=1)
            if sr != target_sr and data.size > 0:
                ratio = target_sr / sr
                new_len = int(round(len(data) * ratio))
                data = np.interp(
                    np.linspace(0, len(data), new_len, endpoint=False),
                    np.arange(len(data)),
                    data,
                ).astype(np.float32)
            return data
        except Exception:
            pass

        # 2) ffmpeg — handles fragmented WebM from Chrome/Firefox MediaRecorder.
        pcm = _decode_via_ffmpeg(audio_bytes, target_sr)
        if pcm is not None and pcm.size > 0:
            return pcm

        # 3) PyAV — occasional Matroska that ffmpeg mishandles.
        pcm_av = _decode_via_av(audio_bytes, target_sr)
        if pcm_av is not None and pcm_av.size > 0:
            return pcm_av

        log.warning(
            "stt.decode.failed_all",
            input_bytes=len(audio_bytes),
            webm_like=_is_webm_header(audio_bytes),
        )
        return np.zeros(0, dtype=np.float32)


def _transcribe_sync_collect(
    model, audio: np.ndarray, language: str
) -> List[Any]:
    """Run Whisper in a worker thread and **fully materialise** segment objects.

    ``model.transcribe`` returns a **lazy generator**. If that generator is
    returned from ``asyncio.to_thread`` and consumed later on the event-loop
    thread, many builds only yield the **first** segment — which looks like a
    single transcript line no matter how many sentences were spoken.
    """
    kwargs = dict(
        language=language,
        vad_filter=True,
        vad_parameters={
            # Silero default ~2000 ms merges short pauses between sentences.
            "min_silence_duration_ms": 400,
            "speech_pad_ms": 120,
        },
        beam_size=1,
    )
    try:
        segments, _info = model.transcribe(audio, **kwargs)
    except TypeError:
        kwargs.pop("vad_parameters", None)
        segments, _info = model.transcribe(audio, **kwargs)
    return list(segments)


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _whisper_segments_to_transcript_rows(segments: List[Any]) -> List[TranscriptSegment]:
    """Turn Whisper segments into stored rows; split long runs on sentence boundaries."""
    out: List[TranscriptSegment] = []
    for seg in segments:
        text = (getattr(seg, "text", None) or "").strip()
        if not text:
            continue
        t0 = float(getattr(seg, "start", 0.0))
        t1 = float(getattr(seg, "end", t0))
        conf = float(getattr(seg, "avg_logprob", 0.0))
        dur = max(t1 - t0, 1e-3)

        parts = [p.strip() for p in _SENTENCE_SPLIT.split(text) if p.strip()]
        if len(parts) <= 1:
            out.append(
                TranscriptSegment(
                    start=t0,
                    end=t1,
                    text=text,
                    speaker="customer",
                    confidence=conf,
                )
            )
            continue

        weights = [max(len(p), 1) for p in parts]
        wsum = float(sum(weights))
        cur = t0
        for p, w in zip(parts, weights):
            span = dur * (w / wsum)
            end = min(cur + span, t1)
            out.append(
                TranscriptSegment(
                    start=round(cur, 3),
                    end=round(end, 3),
                    text=p,
                    speaker="customer",
                    confidence=conf,
                )
            )
            cur = end
    return out
