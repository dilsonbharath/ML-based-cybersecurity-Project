from datetime import date

from fastapi import APIRouter, Depends, Query

from ..database import get_connection, to_list
from ..deps import require_roles

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/nurse")
def nurse_snapshot(user=Depends(require_roles("Doctor", "Nurse", "Administrator", "registration_desk"))):
    today = date.today().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT status FROM appointments WHERE appointment_date = ?",
            (today,),
        ).fetchall()

    statuses = [row["status"] for row in rows]
    pending = len([status for status in statuses if status != "Completed"])
    return {
        "todayPatients": len(statuses),
        "pendingTasks": pending,
    }


@router.get("/admin")
def admin_snapshot(user=Depends(require_roles("Administrator"))):
    today = date.today().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT status FROM appointments WHERE appointment_date = ?",
            (today,),
        ).fetchall()
    statuses = [row["status"] for row in rows]
    completed = len([status for status in statuses if status == "Completed"])
    return {
        "todaysFootfall": len(statuses),
        "consultationsCompleted": completed,
    }


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
    return to_list(rows)
