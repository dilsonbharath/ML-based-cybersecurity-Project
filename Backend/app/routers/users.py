from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..cache import get_cached_json, make_cache_key, set_cached_json
from ..database import get_connection, log_operation, to_list
from ..deps import get_current_user, require_roles
from ..schemas import AdminApprovalUpdate, AdminShiftUpdate

router = APIRouter(prefix="/users", tags=["users"])
SHIFT_SLOTS = {"2-10", "10-18", "18-2"}
SHIFT_ELIGIBLE_ROLES = {"Doctor", "Nurse", "registration_desk"}


@router.get("/doctors")
def get_doctors(
    shift_slot: str | None = Query(default=None),
    user=Depends(get_current_user),
):
    normalized_shift = (shift_slot or "").strip()
    if normalized_shift and normalized_shift not in SHIFT_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid shift slot")

    cache_key = make_cache_key("users", "doctors", normalized_shift or "all")
    cached = get_cached_json(cache_key)
    if cached is not None:
        with get_connection() as conn:
            log_operation(
                conn,
                user["id"],
                "list",
                "users_doctors",
                normalized_shift or "all",
                "Viewed doctors list (cached)",
            )
        return cached

    with get_connection() as conn:
        if normalized_shift:
            rows = conn.execute(
                """
                SELECT id, user_code, full_name, email, shift_slot
                FROM users
                WHERE role = 'Doctor' AND is_active = 1 AND approval_status = 'Approved' AND shift_slot = ?
                ORDER BY full_name
                """,
                (normalized_shift,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, user_code, full_name, email, shift_slot
                FROM users
                WHERE role = 'Doctor' AND is_active = 1 AND approval_status = 'Approved'
                ORDER BY full_name
                """
            ).fetchall()
        log_operation(
            conn,
            user["id"],
            "list",
            "users_doctors",
            normalized_shift or "all",
            "Viewed doctors list",
        )
    data = to_list(rows)
    set_cached_json(cache_key, data, ttl_seconds=60)
    return data


@router.get("/nurses")
def get_nurses(
    shift_slot: str | None = Query(default=None),
    user=Depends(get_current_user),
):
    normalized_shift = (shift_slot or "").strip()
    if normalized_shift and normalized_shift not in SHIFT_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid shift slot")

    cache_key = make_cache_key("users", "nurses", normalized_shift or "all")
    cached = get_cached_json(cache_key)
    if cached is not None:
        with get_connection() as conn:
            log_operation(
                conn,
                user["id"],
                "list",
                "users_nurses",
                normalized_shift or "all",
                "Viewed nurses list (cached)",
            )
        return cached

    with get_connection() as conn:
        if normalized_shift:
            rows = conn.execute(
                """
                SELECT id, user_code, full_name, email, shift_slot
                FROM users
                WHERE role = 'Nurse' AND is_active = 1 AND approval_status = 'Approved' AND shift_slot = ?
                ORDER BY full_name
                """,
                (normalized_shift,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, user_code, full_name, email, shift_slot
                FROM users
                WHERE role = 'Nurse' AND is_active = 1 AND approval_status = 'Approved'
                ORDER BY full_name
                """
            ).fetchall()
        log_operation(
            conn,
            user["id"],
            "list",
            "users_nurses",
            normalized_shift or "all",
            "Viewed nurses list",
        )
    data = to_list(rows)
    set_cached_json(cache_key, data, ttl_seconds=60)
    return data


@router.get("/role-wise")
def get_role_wise_users(user=Depends(require_roles("Administrator"))):
    cache_key = make_cache_key("users", "role-wise")
    cached = get_cached_json(cache_key)
    if cached is not None:
        with get_connection() as conn:
            log_operation(
                conn,
                user["id"],
                "read",
                "users",
                "role-wise",
                "Viewed role-wise users (cached)",
            )
        return cached

    role_order = ["Doctor", "Nurse", "Administrator", "registration_desk"]
    order_lookup = {role: index for index, role in enumerate(role_order)}

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, user_code, full_name, email, role, approval_status, shift_slot
            FROM users
            WHERE is_active = 1
            ORDER BY role, full_name
            """
        ).fetchall()
        log_operation(
            conn,
            user["id"],
            "read",
            "users",
            "role-wise",
            "Viewed role-wise users",
        )

    grouped: dict[str, list[dict]] = {}
    for row in to_list(rows):
        grouped.setdefault(row["role"], []).append(
            {
                "id": row["id"],
                "user_code": row["user_code"],
                "full_name": row["full_name"],
                "email": row["email"],
                "approval_status": row["approval_status"],
                "shift_slot": row["shift_slot"],
            }
        )

    ordered_roles = sorted(grouped.keys(), key=lambda role: order_lookup.get(role, 99))
    data = [
        {
            "role": role,
            "count": len(grouped[role]),
            "users": grouped[role],
        }
        for role in ordered_roles
    ]
    set_cached_json(cache_key, data, ttl_seconds=30)
    return data


@router.get("/pending-approvals")
def get_pending_approvals(user=Depends(require_roles("Administrator"))):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, user_code, full_name, email, role, approval_status, shift_slot, created_at
            FROM users
            WHERE is_active = 1 AND approval_status = 'Pending'
            ORDER BY created_at DESC
            """
        ).fetchall()
        log_operation(
            conn,
            user["id"],
            "read",
            "users",
            "pending-approvals",
            "Viewed pending approvals",
        )
    return to_list(rows)


@router.patch("/{target_user_id}/approval")
def update_approval_status(
    target_user_id: int,
    payload: AdminApprovalUpdate,
    user=Depends(require_roles("Administrator")),
):
    with get_connection() as conn:
        target = conn.execute(
            "SELECT id, role, approval_status FROM users WHERE id = ? AND is_active = 1",
            (target_user_id,),
        ).fetchone()
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        conn.execute(
            "UPDATE users SET approval_status = ? WHERE id = ?",
            (payload.approval_status, target_user_id),
        )
        log_operation(
            conn,
            user["id"],
            "update",
            "users",
            str(target_user_id),
            f"Approval status set to {payload.approval_status}",
        )
    return {"ok": True}


@router.patch("/{target_user_id}/shift")
def update_user_shift(
    target_user_id: int,
    payload: AdminShiftUpdate,
    user=Depends(require_roles("Administrator")),
):
    if payload.shift_slot is not None and payload.shift_slot not in SHIFT_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid shift slot")

    with get_connection() as conn:
        target = conn.execute(
            "SELECT id, role FROM users WHERE id = ? AND is_active = 1",
            (target_user_id,),
        ).fetchone()
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if target["role"] not in SHIFT_ELIGIBLE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift assignment is allowed only for doctor, nurse, and registration desk users",
            )
        conn.execute(
            "UPDATE users SET shift_slot = ? WHERE id = ?",
            (payload.shift_slot, target_user_id),
        )
        log_operation(
            conn,
            user["id"],
            "update",
            "users",
            str(target_user_id),
            f"Shift set to {payload.shift_slot or 'None'}",
        )
    return {"ok": True}


@router.get("/staff-by-shift")
def get_staff_by_shift(
    shift_slot: str = Query(...),
    user=Depends(require_roles("registration_desk", "Administrator")),
):
    if shift_slot not in SHIFT_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid shift slot")
    with get_connection() as conn:
        doctor_rows = conn.execute(
            """
            SELECT id, user_code, full_name, email, shift_slot
            FROM users
            WHERE role = 'Doctor' AND is_active = 1 AND approval_status = 'Approved' AND shift_slot = ?
            ORDER BY full_name
            """,
            (shift_slot,),
        ).fetchall()
        nurse_rows = conn.execute(
            """
            SELECT id, user_code, full_name, email, shift_slot
            FROM users
            WHERE role = 'Nurse' AND is_active = 1 AND approval_status = 'Approved' AND shift_slot = ?
            ORDER BY full_name
            """,
            (shift_slot,),
        ).fetchall()
        log_operation(
            conn,
            user["id"],
            "read",
            "users",
            shift_slot,
            "Viewed staff by shift",
        )
    return {"doctors": to_list(doctor_rows), "nurses": to_list(nurse_rows)}
