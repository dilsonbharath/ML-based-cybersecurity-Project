from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, Header, HTTPException, status

from .database import get_connection


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return token


def get_current_user(authorization: str | None = Header(default=None)):
    token = _parse_bearer_token(authorization)
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
              u.id,
              u.full_name,
              u.email,
              u.role,
              s.token
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
              AND s.expires_at > ?
              AND u.is_active = 1
            """,
            (token, now_iso),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "token": row["token"],
    }


def require_roles(*roles: str) -> Callable:
    def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Allowed roles: {', '.join(roles)}",
            )
        return user

    return checker
