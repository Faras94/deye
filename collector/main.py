"""Scheduled DeyeCloud -> Supabase solar telemetry collector.

Designed to run every 30 minutes via GitHub Actions with minimal API calls
(1 batch /v1.0/device/latest call for all 3 inverters + cached auth token).
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from collector.config import CollectorSettings, get_collector_settings
from collector.database import SupabaseRepository
from collector.deye_client import (
    CredentialRedactingFilter,
    DeyeAPIError,
    DeyeAuthError,
    DeyeCloudClient,
)

logger = logging.getLogger("deye_collector")

_STATE_MAP = {
    1: "online",
    "1": "online",
    "NORMAL": "online",
    "ONLINE": "online",
    2: "alert",
    "2": "alert",
    "ALERT": "alert",
    3: "offline",
    "3": "offline",
    "OFFLINE": "offline",
}


def to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_status(raw_state: Any) -> str:
    if raw_state is None:
        return "unknown"
    if raw_state in _STATE_MAP:
        return _STATE_MAP[raw_state]
    return _STATE_MAP.get(str(raw_state).strip().upper(), "unknown")


def normalize_timestamp(raw_ts: Any) -> str:
    """Normalize DeyeCloud epoch (seconds/ms) or ISO string into UTC ISO-8601."""
    if raw_ts is None or raw_ts == "":
        return datetime.now(timezone.utc).isoformat()
    if isinstance(raw_ts, (int, float)):
        epoch = float(raw_ts)
        if epoch > 1e12:
            epoch /= 1000.0
        return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
    s = str(raw_ts).strip()
    if s.isdigit():
        epoch = float(s)
        if epoch > 1e12:
            epoch /= 1000.0
        return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def extract_data_map(item: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten DeyeCloud `dataList` [{key, value}] into a {key: value} dict."""
    data_map: Dict[str, Any] = {}
    for entry in item.get("dataList") or []:
        if isinstance(entry, dict) and entry.get("key"):
            data_map[str(entry["key"])] = entry.get("value")
    return data_map


def normalize_inverter_reading(
    inverter: Dict[str, Any],
    item: Dict[str, Any],
) -> Dict[str, Any]:
    """Convert raw DeyeCloud /device/latest item into an `inverter_readings` row."""
    data_map = extract_data_map(item)
    recorded_at = normalize_timestamp(item.get("collectionTime"))
    status = normalize_status(item.get("deviceState"))

    return {
        "inverter_id": inverter["id"],
        "device_sn": inverter["device_sn"],
        "recorded_at": recorded_at,
        "power_w": to_float(data_map.get("TotalActiveACOutputPower")),
        "daily_energy_kwh": to_float(data_map.get("DailyActiveProduction")),
        "monthly_energy_kwh": to_float(data_map.get("MonthlyActiveProduction")),
        "total_energy_kwh": to_float(data_map.get("TotalActiveProduction")),
        "ac_voltage_v": to_float(data_map.get("ACVoltage1")),
        "ac_current_a": to_float(data_map.get("ACCurrent1")),
        "ac_frequency_hz": to_float(data_map.get("ACOutputFrequencyR")),
        "temperature_c": to_float(data_map.get("InverterTemperature")),
        "status": status,
        "raw_payload": item,
    }


def extract_panel_readings(
    panels: List[Dict[str, Any]],
    inverter: Dict[str, Any],
    item: Dict[str, Any],
    recorded_at: str,
) -> List[Dict[str, Any]]:
    """Extract panel readings strictly from configured PV channels (no fabricated estimates)."""
    data_map = extract_data_map(item)
    rows: List[Dict[str, Any]] = []

    for panel in panels:
        if panel["inverter_id"] != inverter["id"]:
            continue
        ch = int(panel["channel_index"])
        p_key = panel.get("deye_power_key") or f"DCPowerPV{ch}"
        v_key = panel.get("deye_voltage_key") or f"DCVoltagePV{ch}"
        c_key = panel.get("deye_current_key") or f"DCCurrentPV{ch}"
        e_key = panel.get("deye_energy_key") or f"TotalProduction{ch}"

        power_w = to_float(data_map.get(p_key))
        voltage_v = to_float(data_map.get(v_key))
        current_a = to_float(data_map.get(c_key))
        total_energy = to_float(data_map.get(e_key))

        # Only store if the API actually returned at least one measurement for this PV channel
        if power_w is None and voltage_v is None and current_a is None and total_energy is None:
            continue

        rated_w = float(panel.get("rated_capacity_w") or 630.0)
        perf_pct: Optional[float] = None
        if power_w is not None and rated_w > 0:
            perf_pct = round((power_w / rated_w) * 100.0, 2)

        rows.append(
            {
                "panel_id": panel["id"],
                "inverter_id": inverter["id"],
                "device_sn": inverter["device_sn"],
                "channel_index": ch,
                "recorded_at": recorded_at,
                "power_w": power_w,
                "voltage_v": voltage_v,
                "current_a": current_a,
                "daily_energy_kwh": None,
                "total_energy_kwh": total_energy,
                "performance_pct": perf_pct,
                "is_estimated": False,
            }
        )

    return rows


def run_collection(
    settings: CollectorSettings,
    repo: SupabaseRepository,
    client: Optional[DeyeCloudClient] = None,
) -> Dict[str, Any]:
    """Execute one full collection cycle and return execution summary."""
    log_id = repo.start_collection_log()
    inverters = repo.get_active_inverters()
    panels = repo.get_active_panels()
    inverter_by_sn = {inv["device_sn"]: inv for inv in inverters}
    sns = list(inverter_by_sn.keys()) or settings.configured_device_sns

    owns_client = client is None
    if client is None:
        client = DeyeCloudClient(
            base_url=settings.deye_base_url,
            app_id=settings.deye_app_id,
            app_secret=settings.deye_app_secret,
            email=settings.deye_email,
            password=settings.deye_password,
            company_id=settings.deye_company_id,
            timeout_seconds=settings.api_timeout_seconds,
            token_loader=repo.load_cached_token,
            token_saver=repo.save_cached_token,
        )

    try:
        items = client.get_device_latest(sns)
        inv_rows: List[Dict[str, Any]] = []
        panel_rows: List[Dict[str, Any]] = []
        seen_sns = set()

        for item in items:
            sn = str(item.get("deviceSn") or "").strip()
            inv = inverter_by_sn.get(sn)
            if not inv:
                continue
            seen_sns.add(sn)
            reading = normalize_inverter_reading(inv, item)
            inv_rows.append(reading)

            repo.update_inverter_status(sn, reading["status"], reading["recorded_at"])

            if reading["status"] == "offline":
                repo.create_alert_if_open_missing(
                    alert_type="inverter_offline",
                    severity="warning",
                    title=f"Inverter {sn} offline",
                    message=f"Microinverter {inv['name']} ({sn}) reported offline at {reading['recorded_at']}.",
                    inverter_id=inv["id"],
                    device_sn=sn,
                )

            p_rows = extract_panel_readings(panels, inv, item, reading["recorded_at"])
            panel_rows.extend(p_rows)

            # Update daily and monthly summaries when energy values are present
            dt_utc = datetime.fromisoformat(reading["recorded_at"])
            date_str = dt_utc.strftime("%Y-%m-%d")
            ym_str = dt_utc.strftime("%Y-%m")

            if reading["daily_energy_kwh"] is not None:
                repo.upsert_daily_summary(
                    {
                        "inverter_id": inv["id"],
                        "device_sn": sn,
                        "reading_date": date_str,
                        "energy_kwh": reading["daily_energy_kwh"],
                        "peak_power_w": reading["power_w"],
                        "sample_count": 1,
                    }
                )
            if reading["monthly_energy_kwh"] is not None:
                repo.upsert_monthly_summary(
                    {
                        "inverter_id": inv["id"],
                        "device_sn": sn,
                        "year_month": ym_str,
                        "energy_kwh": reading["monthly_energy_kwh"],
                        "peak_power_w": reading["power_w"],
                    }
                )

        inserted_inv = repo.upsert_inverter_readings(inv_rows)
        inserted_pnl = repo.upsert_panel_readings(panel_rows)

        missing_sns = [sn for sn in sns if sn not in seen_sns]
        status = "success" if not missing_sns else "partial"
        err_msg = f"Missing telemetry for: {', '.join(missing_sns)}" if missing_sns else None

        repo.finish_collection_log(
            log_id=log_id,
            status=status,
            devices_queried=len(sns),
            readings_inserted=inserted_inv + inserted_pnl,
            api_calls_made=client.api_calls_made,
            error_message=err_msg,
            details={"inverter_readings": inserted_inv, "panel_readings": inserted_pnl},
        )
        return {
            "status": status,
            "devices_queried": len(sns),
            "inverter_readings_inserted": inserted_inv,
            "panel_readings_inserted": inserted_pnl,
            "api_calls_made": client.api_calls_made,
        }
    except DeyeAuthError as exc:
        repo.create_alert_if_open_missing(
            alert_type="api_auth_failure",
            severity="critical",
            title="DeyeCloud API authentication failed",
            message=str(exc),
        )
        repo.finish_collection_log(
            log_id=log_id,
            status="failed",
            devices_queried=len(sns),
            readings_inserted=0,
            api_calls_made=client.api_calls_made,
            error_message=str(exc),
        )
        raise
    except DeyeAPIError as exc:
        repo.create_alert_if_open_missing(
            alert_type="collection_failure",
            severity="warning",
            title="DeyeCloud collection failed",
            message=str(exc),
        )
        repo.finish_collection_log(
            log_id=log_id,
            status="failed",
            devices_queried=len(sns),
            readings_inserted=0,
            api_calls_made=client.api_calls_made,
            error_message=str(exc),
        )
        raise
    finally:
        if owns_client:
            client.close()


def main() -> int:
    settings = get_collector_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    redactor = CredentialRedactingFilter(
        [
            settings.deye_app_id,
            settings.deye_app_secret,
            settings.deye_password,
            settings.supabase_service_role_key,
        ]
    )
    logging.getLogger().addFilter(redactor)

    if not settings.has_deye_credentials:
        logger.error("Missing DeyeCloud credentials.")
        return 1
    if not settings.has_supabase_credentials:
        logger.error("Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
        return 1

    repo = SupabaseRepository(settings.supabase_url, settings.supabase_service_role_key)
    summary = run_collection(settings, repo)
    logger.info("Collection finished: %s", summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
