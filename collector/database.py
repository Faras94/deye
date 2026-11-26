"""Supabase database persistence layer for the Python collector."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from supabase import Client, create_client

logger = logging.getLogger(__name__)


class SupabaseRepository:
    """Encapsulates all Supabase PostgreSQL reads/writes using service_role."""

    def __init__(self, url: str, service_role_key: str, client: Optional[Client] = None) -> None:
        self._client: Client = client or create_client(url, service_role_key)

    def get_active_inverters(self) -> List[Dict[str, Any]]:
        resp = (
            self._client.table("inverters")
            .select("*")
            .eq("is_active", True)
            .order("display_order")
            .execute()
        )
        return list(resp.data or [])

    def get_active_panels(self) -> List[Dict[str, Any]]:
        resp = (
            self._client.table("panels")
            .select("*")
            .eq("is_active", True)
            .order("channel_index")
            .execute()
        )
        return list(resp.data or [])

    def load_cached_token(self) -> Optional[Tuple[str, float]]:
        try:
            resp = (
                self._client.table("system_settings")
                .select("value")
                .eq("key", "deye_token_cache")
                .limit(1)
                .execute()
            )
            if not resp.data:
                return None
            val = resp.data[0].get("value") or {}
            tok = val.get("access_token")
            exp = val.get("expires_at")
            if tok and exp:
                return str(tok), float(exp)
        except Exception as exc:
            logger.debug("Could not load cached token from system_settings: %s", exc)
        return None

    def save_cached_token(self, token: str, expires_at: float) -> None:
        try:
            self._client.table("system_settings").upsert(
                {
                    "key": "deye_token_cache",
                    "value": {"access_token": token, "expires_at": expires_at},
                    "description": "Cached DeyeCloud access token to minimize auth API calls",
                },
                on_conflict="key",
            ).execute()
        except Exception as exc:
            logger.debug("Could not persist cached token: %s", exc)

    def update_inverter_status(
        self,
        device_sn: str,
        status: str,
        last_communication_at: Optional[str],
    ) -> None:
        payload: Dict[str, Any] = {"status": status}
        if last_communication_at:
            payload["last_communication_at"] = last_communication_at
        self._client.table("inverters").update(payload).eq("device_sn", device_sn).execute()

    def upsert_inverter_readings(self, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        resp = (
            self._client.table("inverter_readings")
            .upsert(rows, on_conflict="device_sn,recorded_at", ignore_duplicates=True)
            .execute()
        )
        return len(resp.data or [])

    def upsert_panel_readings(self, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        resp = (
            self._client.table("panel_readings")
            .upsert(rows, on_conflict="panel_id,recorded_at", ignore_duplicates=True)
            .execute()
        )
        return len(resp.data or [])

    def upsert_daily_summary(self, row: Dict[str, Any]) -> None:
        self._client.table("daily_energy").upsert(
            row, on_conflict="device_sn,reading_date"
        ).execute()

    def upsert_monthly_summary(self, row: Dict[str, Any]) -> None:
        self._client.table("monthly_energy").upsert(
            row, on_conflict="device_sn,year_month"
        ).execute()

    def start_collection_log(self) -> Optional[int]:
        resp = (
            self._client.table("collection_logs")
            .insert(
                {
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "status": "running",
                }
            )
            .execute()
        )
        if resp.data:
            return int(resp.data[0]["id"])
        return None

    def finish_collection_log(
        self,
        log_id: Optional[int],
        status: str,
        devices_queried: int,
        readings_inserted: int,
        api_calls_made: int,
        error_message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload = {
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "devices_queried": devices_queried,
            "readings_inserted": readings_inserted,
            "api_calls_made": api_calls_made,
            "error_message": error_message,
            "details": details or {},
        }
        if log_id is not None:
            self._client.table("collection_logs").update(payload).eq("id", log_id).execute()
        else:
            payload["started_at"] = payload["finished_at"]
            self._client.table("collection_logs").insert(payload).execute()

    def create_alert_if_open_missing(
        self,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        inverter_id: Optional[str] = None,
        device_sn: Optional[str] = None,
    ) -> None:
        """Create an alert only if an identical unresolved alert does not already exist."""
        query = (
            self._client.table("alerts")
            .select("id")
            .eq("alert_type", alert_type)
            .eq("is_resolved", False)
        )
        if device_sn:
            query = query.eq("device_sn", device_sn)
        existing = query.limit(1).execute()
        if existing.data:
            return

        self._client.table("alerts").insert(
            {
                "inverter_id": inverter_id,
                "device_sn": device_sn,
                "alert_type": alert_type,
                "severity": severity,
                "title": title,
                "message": message,
            }
        ).execute()
