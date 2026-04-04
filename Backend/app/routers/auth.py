from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_connection, log_operation, to_dict
from ..deps import get_current_user
from ..schemas import AuthResponse, SignInRequest, SignUpRequest
from ..security import create_token, hash_password, token_expiry, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
def signup(payload: SignUpRequest):
    email = payload.email.lower().strip()

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            (email,),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

        cursor = conn.execute(
            """
            INSERT INTO users (full_name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
            """,
            (payload.full_name.strip(), email, hash_password(payload.password), payload.role),
        )
        user_id = int(cursor.lastrowid)
        log_operation(conn, user_id, "signup", "users", str(user_id), "New account created")

    return {"ok": True, "message": "Signup successful. Please sign in."}


@router.post("/signin", response_model=AuthResponse)
def signin(payload: SignInRequest):
    email = payload.email.lower().strip()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, full_name, email, role, password_hash FROM users WHERE LOWER(email) = ? AND is_active = 1",
            (email,),
        ).fetchone()
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        token = create_token()
        expires_at = token_expiry().isoformat()
        conn.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
            (row["id"], token, expires_at),
        )
        log_operation(conn, row["id"], "signin", "sessions", token, "User signed in")

    user = {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
    }
    return {"token": token, "user": user}


@router.post("/logout")
def logout(user=Depends(get_current_user)):
    with get_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (user["token"],))
        log_operation(conn, user["id"], "logout", "sessions", user["token"], "User signed out")
    return {"ok": True}


@router.get("/me")
def me(user=Depends(get_current_user)):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, full_name, email, role FROM users WHERE id = ?",
            (user["id"],),
        ).fetchone()
    data = to_dict(row)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return data
