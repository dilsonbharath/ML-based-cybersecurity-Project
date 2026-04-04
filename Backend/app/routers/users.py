from fastapi import APIRouter, Depends

from ..database import get_connection, to_list
from ..deps import get_current_user

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
