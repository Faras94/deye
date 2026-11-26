"""Collector configuration loaded from environment variables or root .env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_DIR = Path(__file__).resolve().parents[1]


class CollectorSettings(BaseSettings):
    """Configuration for the scheduled DeyeCloud -> Supabase collector."""

    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_DIR / ".env"),),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    deye_base_url: str = Field(default="https://india-developer.deyecloud.com")
    deye_app_id: str = Field(default="")
    deye_app_secret: str = Field(default="")
    deye_email: str = Field(default="")
    deye_password: str = Field(default="")
    deye_device_sns: str = Field(default="260605A076,260603A1D5,260505A373")
    deye_company_id: int = Field(default=0)

    @field_validator("deye_company_id", mode="before")
    @classmethod
    def _parse_company_id(cls, value: object) -> int:
        if value is None or str(value).strip() == "":
            return 0
        return int(str(value).strip())

    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")

    collection_interval_minutes: int = Field(default=30, ge=5, le=120)
    api_timeout_seconds: float = Field(default=20.0, ge=5.0, le=120.0)
    log_level: str = Field(default="INFO")

    @property
    def configured_device_sns(self) -> List[str]:
        seen = set()
        result: List[str] = []
        for raw in self.deye_device_sns.split(","):
            sn = raw.strip()
            if sn and sn not in seen:
                seen.add(sn)
                result.append(sn)
        return result

    @property
    def has_deye_credentials(self) -> bool:
        return bool(
            self.deye_app_id.strip()
            and self.deye_app_secret.strip()
            and self.deye_email.strip()
            and self.deye_password.strip()
        )

    @property
    def has_supabase_credentials(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_service_role_key.strip())


@lru_cache
def get_collector_settings() -> CollectorSettings:
    return CollectorSettings()
