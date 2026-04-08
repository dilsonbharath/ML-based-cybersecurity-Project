from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..cache import get_cached_json, make_cache_key, set_cached_json
from ..database import get_connection, log_operation, to_list
from ..deps import require_roles
from ..ml_client import MLClientError, healthcheck, score_events
from ..security_alerts import build_ml_events, is_within_lookback, parse_timestamp

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/nurse")
def nurse_snapshot(user=Depends(require_roles("Doctor", "Nurse", "Administrator", "registration_desk"))):
    today = date.today().isoformat()
    cache_key = make_cache_key("dashboard", "nurse", today)
    cached = get_cached_json(cache_key)
    if cached is not None:
        return cached

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT status FROM appointments WHERE appointment_date = ?",
            (today,),
        ).fetchall()
        log_operation(
            conn,
            user["id"],
            "read",
            "dashboard",
            "nurse",
            "Viewed nurse dashboard snapshot",
        )

    statuses = [row["status"] for row in rows]
    pending = len([status for status in statuses if status != "Completed"])
    data = {
        "todayPatients": len(statuses),
        "pendingTasks": pending,
    }
    set_cached_json(cache_key, data, ttl_seconds=8)
    return data


@router.get("/admin")
def admin_snapshot(user=Depends(require_roles("Administrator"))):
    today = date.today().isoformat()
    cache_key = make_cache_key("dashboard", "admin", today)
    cached = get_cached_json(cache_key)
    if cached is not None:
        return cached

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT status FROM appointments WHERE appointment_date = ?",
            (today,),
        ).fetchall()
        log_operation(
            conn,
            user["id"],
            "read",
            "dashboard",
            "admin",
            "Viewed admin dashboard snapshot",
        )
    statuses = [row["status"] for row in rows]
    completed = len([status for status in statuses if status == "Completed"])
    data = {
        "todaysFootfall": len(statuses),
        "consultationsCompleted": completed,
    }
    set_cached_json(cache_key, data, ttl_seconds=8)
    return data


@router.get("/operations")
def recent_operations(
    limit: int = Query(default=20, ge=1, le=100),
    user=Depends(require_roles("Administrator")),
):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              l.id,
              l.action,
              l.entity_type,
              l.entity_id,
              l.details,
              l.created_at,
              COALESCE(u.full_name, 'System') AS user_name
            FROM operation_logs l
            LEFT JOIN users u ON u.id = l.user_id
            ORDER BY l.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        log_operation(
            conn,
            user["id"],
            "read",
            "operation_logs",
            "recent",
            f"Viewed last {limit} operation logs",
        )
    return to_list(rows)


def _fetch_unscored_logs(conn, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
          l.id AS log_id,
          l.user_id,
          l.action,
          l.entity_type,
          l.entity_id,
          l.details,
          l.created_at,
          u.user_code,
          u.role,
          u.shift_slot
        FROM operation_logs l
        LEFT JOIN users u ON u.id = l.user_id
        LEFT JOIN security_alerts s ON s.log_id = l.id
        WHERE s.log_id IS NULL
          AND l.entity_type <> 'security_alerts'
        ORDER BY l.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return to_list(rows)


def _persist_alerts(
    conn,
    log_rows: list[dict],
    scored_rows: list[dict],
) -> list[dict]:
    persisted: list[dict] = []
    for log_row, scored_row in zip(log_rows, scored_rows):
        risk_score = float(scored_row.get("risk_score", 0.0))
        risk_band = str(scored_row.get("risk_band", "normal"))
        reason_codes = str(scored_row.get("reason_codes", ""))
        event_time = str(scored_row.get("event_time", log_row.get("created_at") or ""))

        conn.execute(
            """
            INSERT INTO security_alerts (
              log_id,
              user_id,
              user_code,
              role,
              action,
              entity_type,
              entity_id,
              details,
              risk_score,
              risk_band,
              reason_codes,
              event_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(log_id) DO UPDATE SET
              user_id = excluded.user_id,
              user_code = excluded.user_code,
              role = excluded.role,
              action = excluded.action,
              entity_type = excluded.entity_type,
              entity_id = excluded.entity_id,
              details = excluded.details,
              risk_score = excluded.risk_score,
              risk_band = excluded.risk_band,
              reason_codes = excluded.reason_codes,
              event_time = excluded.event_time,
              scored_at = CURRENT_TIMESTAMP
            """,
            (
                log_row.get("log_id"),
                log_row.get("user_id"),
                log_row.get("user_code"),
                log_row.get("role"),
                log_row.get("action"),
                log_row.get("entity_type"),
                log_row.get("entity_id"),
                log_row.get("details"),
                risk_score,
                risk_band,
                reason_codes,
                event_time,
            ),
        )
        persisted.append(
            {
                "log_id": log_row.get("log_id"),
                "risk_score": risk_score,
                "risk_band": risk_band,
                "reason_codes": reason_codes,
                "role": log_row.get("role"),
                "action": log_row.get("action"),
                "entity_type": log_row.get("entity_type"),
                "entity_id": log_row.get("entity_id"),
                "user_code": log_row.get("user_code"),
                "event_time": event_time,
            }
        )
    return persisted


@router.post("/security/refresh")
def refresh_security_alerts(
    lookback_hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=300, ge=1, le=1000),
    user=Depends(require_roles("Administrator")),
):
    with get_connection() as conn:
        candidate_logs = _fetch_unscored_logs(conn, limit=limit)

    recent_logs = [row for row in candidate_logs if is_within_lookback(row.get("created_at"), lookback_hours)]
    if not recent_logs:
        return {
            "ok": True,
            "scored": 0,
            "high": 0,
            "medium": 0,
            "message": "No new operation logs to score in the selected lookback window.",
        }

    ordered_logs = sorted(
        recent_logs,
        key=lambda row: (parse_timestamp(row.get("created_at")), int(row.get("log_id") or 0)),
    )
    ml_events = build_ml_events(ordered_logs)
    try:
        scored = score_events(ml_events, source="backend_operation_logs")
    except MLClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if len(scored) != len(ordered_logs):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ML service returned a mismatched score count",
        )

    with get_connection() as conn:
        persisted = _persist_alerts(conn, ordered_logs, scored)
        log_operation(
            conn,
            user["id"],
            "refresh",
            "security_alerts",
            "batch",
            f"Scored {len(persisted)} operation logs via ML service",
        )

    high = len([row for row in persisted if row["risk_band"] == "anomaly"])
    medium = len([row for row in persisted if row["risk_band"] == "suspicious"])
    return {
        "ok": True,
        "scored": len(persisted),
        "high": high,
        "medium": medium,
        "alerts": [row for row in persisted if row["risk_band"] in {"anomaly", "suspicious"}][:25],
    }


@router.get("/security/alerts")
def list_security_alerts(
    risk_band: str | None = Query(default=None),
    limit: int = Query(default=80, ge=1, le=400),
    lookback_days: int = Query(default=30, ge=1, le=90),
    user=Depends(require_roles("Administrator")),
):
    normalized_band = (risk_band or "").strip().lower()
    if normalized_band and normalized_band not in {"normal", "suspicious", "anomaly"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid risk band")

    cutoff = parse_timestamp(None).replace(microsecond=0) - timedelta(days=lookback_days)

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              a.id,
              a.log_id,
              a.user_id,
              a.user_code,
              a.role,
              a.action,
              a.entity_type,
              a.entity_id,
              a.details,
              a.risk_score,
              a.risk_band,
              a.reason_codes,
              a.event_time,
              a.scored_at,
              COALESCE(u.full_name, 'System') AS user_name
            FROM security_alerts a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        data = []
        for row in to_list(rows):
            band = str(row.get("risk_band") or "normal").lower()
            if normalized_band and band != normalized_band:
                continue
            if parse_timestamp(row.get("event_time")) < cutoff:
                continue
            data.append(row)

        log_operation(
            conn,
            user["id"],
            "read",
            "security_alerts",
            "list",
            f"Viewed security alerts (band={normalized_band or 'all'})",
        )

    return data


@router.get("/security/summary")
def security_summary(
    lookback_days: int = Query(default=30, ge=1, le=90),
    user=Depends(require_roles("Administrator")),
):
    cutoff = parse_timestamp(None).replace(microsecond=0) - timedelta(days=lookback_days)

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, role, risk_band, risk_score, reason_codes, event_time, scored_at
            FROM security_alerts
            ORDER BY id DESC
            LIMIT 1000
            """
        ).fetchall()
        alerts = [row for row in to_list(rows) if parse_timestamp(row.get("event_time")) >= cutoff]

        by_role: dict[str, dict[str, int]] = {}
        high = 0
        medium = 0
        for alert in alerts:
            role = str(alert.get("role") or "Unknown")
            role_bucket = by_role.setdefault(role, {"high": 0, "medium": 0})
            if alert.get("risk_band") == "anomaly":
                high += 1
                role_bucket["high"] += 1
            elif alert.get("risk_band") == "suspicious":
                medium += 1
                role_bucket["medium"] += 1

        try:
            ml_health = healthcheck()
        except MLClientError as exc:
            ml_health = {"ok": False, "detail": str(exc)}

        log_operation(
            conn,
            user["id"],
            "read",
            "security_alerts",
            "summary",
            "Viewed security alert summary",
        )

    role_breakdown = [
        {
            "role": role,
            "high": values["high"],
            "medium": values["medium"],
            "total": values["high"] + values["medium"],
        }
        for role, values in sorted(by_role.items(), key=lambda item: item[0])
    ]

    return {
        "lookback_days": lookback_days,
        "total_scored": len(alerts),
        "high_risk": high,
        "medium_risk": medium,
        "role_breakdown": role_breakdown,
        "ml_service": ml_health,
    }
