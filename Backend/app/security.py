import hashlib
import uuid
from datetime import datetime, timedelta, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def create_token() -> str:
    return uuid.uuid4().hex


def token_expiry(hours: int = 12) -> datetime:
    return utc_now() + timedelta(hours=hours)
