"""Ollama-backed implementation of `ILLMClient`.

Uses the local Ollama HTTP API (default ``http://ollama:11434``).

**404 handling:** Ollama returns **HTTP 404** when the configured **model name
does not exist locally** (not pulled yet) — the same status is used for both
``/api/chat`` and ``/api/generate``. We try ``/api/chat`` first, then fall back
to ``/api/generate`` (older servers), and surface a clear error that lists
``ollama list`` / ``ollama pull`` hints.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional, Sequence

import httpx

from app.core.config import get_settings
from app.core.exceptions import UpstreamServiceError
from app.core.logging import get_logger
from app.schemas.domain import ExtractedCustomerProfile, TranscriptSegment
from app.services.interfaces import ILLMClient
from app.services.llm.prompts import (
    PROFILE_EXTRACTION_SYSTEM,
    PROFILE_EXTRACTION_USER_TEMPLATE,
)

log = get_logger(__name__)


class OllamaLLMClient(ILLMClient):
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._model = model or settings.ollama_model
        self._timeout = timeout_seconds or settings.llm_timeout_seconds

    async def _list_model_names(self, client: httpx.AsyncClient) -> list[str]:
        try:
            r = await client.get(f"{self._base_url}/api/tags")
            if r.status_code != 200:
                return []
            data = r.json()
            return [m["name"] for m in data.get("models", []) if isinstance(m, dict) and m.get("name")]
        except Exception:
            return []

    def _ollama_error_detail(self, resp: httpx.Response) -> str:
        try:
            j = resp.json()
            if isinstance(j, dict) and j.get("error"):
                return str(j["error"])
        except Exception:
            pass
        return (resp.text or "")[:400]

    async def _fail_helpful(self, client: httpx.AsyncClient, resp: httpx.Response) -> None:
        detail = self._ollama_error_detail(resp)
        names = await self._list_model_names(client)
        hint = ""
        if names:
            hint = f" Models on this server: {', '.join(names[:12])}"
            if len(names) > 12:
                hint += " …"
        else:
            hint = (
                " Could not list models (`GET /api/tags`). "
                "Confirm OLLAMA_BASE_URL is the Ollama server (e.g. http://ollama:11434) "
                "and the `ollama` container is running."
            )
        raise UpstreamServiceError(
            f"Ollama HTTP {resp.status_code} at {resp.request.url!s}. "
            f"{detail or 'Request failed.'}"
            f"{hint} "
            f"If the model is missing: `ollama pull {self._model}` "
            f"or set OLLAMA_MODEL to an exact tag from `ollama list`."
        )

    async def _complete_via_generate(
        self,
        client: httpx.AsyncClient,
        system: str,
        user: str,
        *,
        json_mode: bool,
        temperature: float,
    ) -> Optional[str]:
        """Older Ollama builds; ``/api/generate`` with ``system`` + ``prompt``."""
        payload: dict[str, Any] = {
            "model": self._model,
            "system": system,
            "prompt": user,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if json_mode:
            payload["format"] = "json"
        resp = await client.post(f"{self._base_url}/api/generate", json=payload)
        if resp.status_code != 200:
            return None
        data = resp.json()
        return (data.get("response") or "").strip()

    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        temperature: float = 0.2,
    ) -> str:
        chat_payload: dict[str, Any] = {
            "model": self._model,
            "stream": False,
            "options": {"temperature": temperature},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            chat_payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/chat",
                    json=chat_payload,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    return (data.get("message") or {}).get("content", "").strip()

                log.warning(
                    "llm.ollama.chat_non_ok",
                    status=resp.status_code,
                    detail=self._ollama_error_detail(resp),
                )

                if resp.status_code == 404:
                    alt = await self._complete_via_generate(
                        client, system, user, json_mode=json_mode, temperature=temperature
                    )
                    if alt is not None:
                        log.info("llm.ollama.used_generate_fallback")
                        return alt

                if resp.status_code >= 400:
                    await self._fail_helpful(client, resp)

                raise UpstreamServiceError(
                    f"Unexpected Ollama response {resp.status_code}: "
                    f"{self._ollama_error_detail(resp)}"
                )

        except UpstreamServiceError:
            raise
        except httpx.HTTPError as exc:
            log.error("llm.ollama.http_error", error=str(exc))
            raise UpstreamServiceError(f"Ollama request failed: {exc}") from exc

    async def extract_profile(
        self, transcript_segments: Sequence[TranscriptSegment]
    ) -> ExtractedCustomerProfile:
        if not transcript_segments:
            return ExtractedCustomerProfile()

        transcript_text = "\n".join(
            f"[{seg.start:.1f}-{seg.end:.1f}] {seg.text}" for seg in transcript_segments
        )
        user_msg = PROFILE_EXTRACTION_USER_TEMPLATE.format(transcript=transcript_text)
        raw = await self.complete(
            system=PROFILE_EXTRACTION_SYSTEM,
            user=user_msg,
            json_mode=True,
            temperature=0.1,
        )

        parsed = self._safe_json(raw)
        if not parsed:
            log.warning("llm.profile.parse_failed", raw_preview=raw[:200])
            return ExtractedCustomerProfile()

        try:
            return ExtractedCustomerProfile.model_validate(parsed)
        except Exception as exc:
            log.warning("llm.profile.validation_failed", error=str(exc))
            return ExtractedCustomerProfile()

    @staticmethod
    def _safe_json(raw: str) -> Optional[dict]:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    return None
            return None
