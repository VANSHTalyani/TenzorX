"""Application configuration loaded from environment variables.

Uses pydantic-settings for type-safe, validated configuration. A single
`Settings` instance is exposed via `get_settings()` and cached so that all
modules see consistent values without re-parsing the environment.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "poonawalla-loan-wizard"
    log_level: str = "INFO"
    secret_key: str = "change-me"
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    postgres_dsn: str = "postgresql+asyncpg://loan:loan@localhost:5432/loanwizard"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b-instruct"
    llm_timeout_seconds: int = 180

    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_language: str = "en"
    # Max parallel Whisper decode+infer jobs (different sessions can run together).
    stt_max_concurrent: int = 4

    vision_backend: str = "deepface"
    vision_age_tolerance_years: int = 7

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "loan-wizard-recordings"
    minio_secure: bool = False

    policy_min_age: int = 21
    policy_max_age: int = 65
    policy_min_income_monthly: int = 20000
    policy_max_loan_amount: int = 2_500_000
    policy_min_loan_amount: int = 50_000

    risk_model_path: str = "data/models/risk_xgb.json"
    risk_model_features_path: str = "data/models/risk_features.json"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a process-wide cached `Settings` instance."""
    return Settings()
