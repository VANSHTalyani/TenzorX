"""MinIO-backed object storage (S3-compatible, free, self-hosted)."""
from __future__ import annotations

import asyncio
import io
from typing import Optional

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.interfaces import IObjectStorage

log = get_logger(__name__)


class MinioObjectStorage(IObjectStorage):
    def __init__(self, bucket: Optional[str] = None) -> None:
        settings = get_settings()
        from minio import Minio

        self._client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self._bucket = bucket or settings.minio_bucket
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
                log.info("storage.bucket.created", bucket=self._bucket)
        except Exception as exc:
            log.warning("storage.bucket.check_failed", error=str(exc))

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        await asyncio.to_thread(self._put_sync, key, data, content_type)
        return f"s3://{self._bucket}/{key}"

    def _put_sync(self, key: str, data: bytes, content_type: str) -> None:
        self._client.put_object(
            self._bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(self._get_sync, key)

    def _get_sync(self, key: str) -> bytes:
        resp = self._client.get_object(self._bucket, key)
        try:
            return resp.read()
        finally:
            resp.close()
            resp.release_conn()
