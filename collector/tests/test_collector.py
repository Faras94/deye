"""Unit and integration tests for the V2 Python collector."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock

import pytest

from collector.config import CollectorSettings
from collector.deye_client import (
    DeyeAuthError,
    DeyeCloudClient,
    DeyeConfigError,
    DeyeRateLimitError,
)
from collector.main import (
    extract_panel_readings,
    normalize_inverter_reading,
    run_collection,
)


class FakeResponse:
    def __init__(self, status_code: int, body: Dict[str, Any]):
        self.status_code = status_code
        self._body = body
        self.ok = 200 <= status_code < 300

    def json(self) -> Dict[str, Any]:
        return self._body


class FakeRepo:
    def __init__(self) -> None:
        self.inverters = [
            {"id": "inv-1", "device_sn": "260605A076", "name": "Microinverter 1 (2.2 kW)"},
            {"id": "inv-2", "device_sn": "260603A1D5", "name": "Microinverter 2 (2.2 kW)"},
            {"id": "inv-3", "device_sn": "260505A373", "name": "Microinverter 3 (1.0 kW)"},
        ]
        self.panels = [
            {
                "id": "pnl-1",
                "inverter_id": "inv-1",
                "channel_index": 1,
                "rated_capacity_w": 630.0,
            }
        ]
        self.inv_readings: List[Dict[str, Any]] = []
        self.seen_keys = set()
        self.panel_readings: List[Dict[str, Any]] = []
        self.daily_summaries: List[Dict[str, Any]] = []
        self.monthly_summaries: List[Dict[str, Any]] = []
        self.alerts: List[Dict[str, Any]] = []
        self.logs: List[Dict[str, Any]] = []

    def get_active_inverters(self):
        return self.inverters

    def get_active_panels(self):
        return self.panels

    def load_cached_token(self):
        return None

    def save_cached_token(self, token: str, expires_at: float):
        pass

    def update_inverter_status(self, device_sn: str, status: str, last_communication_at: Optional[str]):
        pass

    def upsert_inverter_readings(self, rows: List[Dict[str, Any]]) -> int:
        inserted = 0
        for row in rows:
            key = (row["device_sn"], row["recorded_at"])
            if key not in self.seen_keys:
                self.seen_keys.add(key)
                self.inv_readings.append(row)
                inserted += 1
        return inserted

    def upsert_panel_readings(self, rows: List[Dict[str, Any]]) -> int:
        self.panel_readings.extend(rows)
        return len(rows)

    def upsert_daily_summary(self, row: Dict[str, Any]) -> None:
        self.daily_summaries.append(row)

    def upsert_monthly_summary(self, row: Dict[str, Any]) -> None:
        self.monthly_summaries.append(row)

    def start_collection_log(self) -> int:
        return 1

    def finish_collection_log(self, **kwargs: Any) -> None:
        self.logs.append(kwargs)

    def create_alert_if_open_missing(self, **kwargs: Any) -> None:
        self.alerts.append(kwargs)


def test_sha256_password_hash():
    digest = DeyeCloudClient.hash_password("Faras@2001")
    assert len(digest) == 64
    assert digest == digest.lower()


def test_missing_credentials_raises_config_error():
    client = DeyeCloudClient("https://india-developer.deyecloud.com", "", "", "", "")
    with pytest.raises(DeyeConfigError):
        client.obtain_token()


def test_rate_limit_raises_error():
    session = MagicMock()
    session.post.side_effect = [
        FakeResponse(200, {"code": "1000000", "accessToken": "tok-1", "expiresIn": 3600}),
        FakeResponse(429, {"msg": "Too many requests"}),
        FakeResponse(429, {"msg": "Too many requests"}),
        FakeResponse(429, {"msg": "Too many requests"}),
    ]
    client = DeyeCloudClient(
        "https://india-developer.deyecloud.com",
        "app1",
        "sec1",
        "user@example.com",
        "pass",
        session=session,
    )
    with pytest.raises(DeyeRateLimitError):
        client.get_device_latest(["260605A076"])


def test_normalize_and_deduplicate_readings():
    repo = FakeRepo()
    settings = CollectorSettings(
        deye_app_id="a",
        deye_app_secret="b",
        deye_email="u@e.com",
        deye_password="p",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-key",
    )
    mock_client = MagicMock()
    mock_client.api_calls_made = 1
    mock_client.get_device_latest.return_value = [
        {
            "deviceSn": "260605A076",
            "deviceState": 1,
            "collectionTime": 1732620000,
            "dataList": [
                {"key": "TotalActiveACOutputPower", "value": "1420.5"},
                {"key": "DailyActiveProduction", "value": "6.4"},
                {"key": "MonthlyActiveProduction", "value": "112.0"},
                {"key": "DCPowerPV1", "value": "510.0"},
            ],
        }
    ]

    first = run_collection(settings, repo, client=mock_client)
    second = run_collection(settings, repo, client=mock_client)

    assert first["inverter_readings_inserted"] == 1
    assert second["inverter_readings_inserted"] == 0
    assert len(repo.panel_readings) == 2  # 1 per run in fake repo
    assert repo.panel_readings[0]["is_estimated"] is False
    assert repo.panel_readings[0]["performance_pct"] == pytest.approx(80.95, 0.01)


def test_panel_readings_never_invented_when_absent():
    inv = {"id": "inv-1", "device_sn": "260605A076"}
    panels = [{"id": "pnl-1", "inverter_id": "inv-1", "channel_index": 1, "rated_capacity_w": 630}]
    item = {"deviceSn": "260605A076", "dataList": [{"key": "TotalActiveACOutputPower", "value": "1000"}]}
    rows = extract_panel_readings(panels, inv, item, "2026-11-26T10:00:00+00:00")
    assert rows == []


def test_auth_failure_creates_alert_and_failed_log():
    repo = FakeRepo()
    settings = CollectorSettings(
        deye_app_id="a",
        deye_app_secret="b",
        deye_email="u@e.com",
        deye_password="p",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-key",
    )
    mock_client = MagicMock()
    mock_client.api_calls_made = 1
    mock_client.get_device_latest.side_effect = DeyeAuthError("Invalid credentials")

    with pytest.raises(DeyeAuthError):
        run_collection(settings, repo, client=mock_client)

    assert len(repo.alerts) == 1
    assert repo.alerts[0]["alert_type"] == "api_auth_failure"
    assert repo.logs[-1]["status"] == "failed"
