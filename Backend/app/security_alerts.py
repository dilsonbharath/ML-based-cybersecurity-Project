from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any

READ_ACTIONS = {"read", "view", "list", "search"}
WRITE_ACTIONS = {"create", "update", "patch", "delete"}
DENIED_ACTIONS = {"denied", "forbidden", "blocked"}

PATIENT_ENTITY_TYPES = {
    "patients",
    "patient_record",
    "vitals",
    "lab_orders",
    "lab_results",
    "imaging_orders",
    "imaging_reports",
    "charges",
}
CLINICAL_ENTITY_TYPES = {
    "patient_record",
    "vitals",
    "lab_orders",
    "lab_results",
    "imaging_orders",
    "imaging_reports",
}


def parse_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    raw = str(value).strip()
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return datetime.now(timezone.utc)

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_within_lookback(created_at: str | None, lookback_hours: int) -> bool:
    dt = parse_timestamp(created_at)
    return dt >= (datetime.now(timezone.utc) - timedelta(hours=max(1, lookback_hours)))


def _action_buckets(action: str) -> tuple[int, int, int]:
    normalized = (action or "").strip().lower()
    read_count = int(normalized in READ_ACTIONS)
    write_count = int(normalized in WRITE_ACTIONS)
    denied_count = int(normalized in DENIED_ACTIONS)
    return read_count, write_count, denied_count


def _is_in_shift(shift_slot: str | None, hour: int) -> int:
    if shift_slot == "2-10":
        return int(2 <= hour < 10)
    if shift_slot == "10-18":
        return int(10 <= hour < 18)
    if shift_slot == "18-2":
        return int(hour >= 18 or hour < 2)
    return 1


def _safe_ratio(numerator: float, denominator: float) -> float:
    return float(numerator / denominator) if denominator > 0 else 0.0


def _patient_key(entity_type: str, entity_id: Any) -> str | None:
    if entity_type not in PATIENT_ENTITY_TYPES:
        return None
    text = str(entity_id or "").strip()
    return text or None


def build_ml_events(log_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not log_rows:
        return []

    sorted_rows = sorted(log_rows, key=lambda row: (parse_timestamp(str(row.get("created_at"))), int(row.get("log_id") or 0)))

    # Per-user rolling 60-minute activity window to derive baseline behavior features.
    rolling_by_user: dict[str, deque[dict[str, Any]]] = defaultdict(deque)
    events: list[dict[str, Any]] = []

    for row in sorted_rows:
        created_dt = parse_timestamp(str(row.get("created_at")))
        role = str(row.get("role") or "Administrator")
        shift_slot = str(row.get("shift_slot") or "10-18")
        action = str(row.get("action") or "read")
        entity_type = str(row.get("entity_type") or "unknown").lower()
        details = str(row.get("details") or "")
        details_lower = details.lower()

        user_key = str(row.get("user_id") or row.get("user_code") or f"anon-{row.get('log_id')}")
        window = rolling_by_user[user_key]
        cutoff = created_dt - timedelta(hours=1)
        while window and window[0]["timestamp"] < cutoff:
            window.popleft()

        read_current, write_current, denied_current = _action_buckets(action)
        patient_key = _patient_key(entity_type, row.get("entity_id"))
        appointment_touch = int(entity_type == "appointments")
        record_read_current = int(read_current == 1 and entity_type in CLINICAL_ENTITY_TYPES)
        search_current = int(action.strip().lower() == "search")
        in_shift_flag = _is_in_shift(shift_slot, created_dt.hour)
        off_shift_flag = int(in_shift_flag == 0 and (read_current or write_current))

        read_window = sum(item["read"] for item in window) + read_current
        write_window = sum(item["write"] for item in window) + write_current
        denied_window = sum(item["denied"] for item in window) + denied_current
        appointment_window = sum(item["appointment_touch"] for item in window) + appointment_touch
        record_read_window = sum(item["record_read"] for item in window) + record_read_current
        search_window = sum(item["search"] for item in window) + search_current
        offshift_window = sum(item["off_shift"] for item in window) + off_shift_flag

        patient_keys = {item["patient_key"] for item in window if item.get("patient_key")}
        if patient_key:
            patient_keys.add(patient_key)

        total_requests_window = read_window + write_window + denied_window
        unique_patients_accessed = len(patient_keys)

        nurse_unassigned_access_ratio = 0.0
        if role == "Nurse" and read_current and entity_type in PATIENT_ENTITY_TYPES:
            if "unassigned" in details_lower or "not assigned" in details_lower:
                nurse_unassigned_access_ratio = 1.0
            else:
                nurse_unassigned_access_ratio = 0.45

        regdesk_clinical_read_ratio = 0.0
        if role == "registration_desk" and read_current and entity_type in CLINICAL_ENTITY_TYPES:
            regdesk_clinical_read_ratio = 1.0

        event = {
            "event_time": to_iso_z(created_dt),
            "role": role,
            "shift_slot": shift_slot,
            "in_shift_flag": in_shift_flag,
            "user_id": row.get("user_code") or row.get("user_id") or user_key,
            "patient_id": row.get("entity_id") if patient_key else f"entity-{row.get('entity_type')}-{row.get('entity_id')}",
            "session_id": f"session-{user_key}",
            "request_id": str(row.get("log_id") or ""),
            "ip_address": "0.0.0.0",
            "read_count": read_window,
            "write_count": write_window,
            "denied_count": denied_window,
            "total_requests_window": total_requests_window,
            "unique_patients_accessed": unique_patients_accessed,
            "patient_search_count": search_window,
            "patient_record_read_count": record_read_window,
            "appointment_linked_access_ratio": _safe_ratio(appointment_window, max(1, read_window + write_window)),
            "offshift_access_ratio": _safe_ratio(offshift_window, max(1, read_window + write_window)),
            "concurrent_session_count": 1,
            "ip_change_flag": 0,
            "user_agent_change_flag": 0,
            "nurse_unassigned_access_ratio": nurse_unassigned_access_ratio,
            "regdesk_clinical_read_ratio": regdesk_clinical_read_ratio,
            "read_write_ratio": _safe_ratio(read_window, max(1, write_window)),
            "failed_auth_ratio": _safe_ratio(denied_window, max(1, total_requests_window)),
        }
        events.append(event)

        window.append(
            {
                "timestamp": created_dt,
                "read": read_current,
                "write": write_current,
                "denied": denied_current,
                "patient_key": patient_key,
                "appointment_touch": appointment_touch,
                "record_read": record_read_current,
                "search": search_current,
                "off_shift": off_shift_flag,
            }
        )

    return events
