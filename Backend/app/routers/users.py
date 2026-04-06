from fastapi import APIRouter, Depends

from ..database import get_connection, to_list
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/doctors")
def get_doctors(user=Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, full_name, email
            FROM users
            WHERE role = 'Doctor' AND is_active = 1
            ORDER BY full_name
            """
        ).fetchall()
    return to_list(rows)


@router.get("/role-wise")
def get_role_wise_users(user=Depends(require_roles("Administrator"))):
    role_order = ["Doctor", "Nurse", "Administrator", "registration_desk"]
    order_lookup = {role: index for index, role in enumerate(role_order)}

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, full_name, email, role
            FROM users
            WHERE is_active = 1
            ORDER BY role, full_name
            """
        ).fetchall()

    grouped: dict[str, list[dict]] = {}
    for row in to_list(rows):
        grouped.setdefault(row["role"], []).append(
            {
                "id": row["id"],
                "full_name": row["full_name"],
                "email": row["email"],
            }
        )

    ordered_roles = sorted(grouped.keys(), key=lambda role: order_lookup.get(role, 99))
    return [
        {
            "role": role,
            "count": len(grouped[role]),
            "users": grouped[role],
        }
        for role in ordered_roles
    ]
