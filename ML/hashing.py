from __future__ import annotations

import hashlib
import hmac
import os
from functools import lru_cache

_DEFAULT_HASH_SECRET = "dev-only-ml-secret-change-me"


@lru_cache(maxsize=1)
def get_hash_secret() -> str:
    return os.getenv("ML_HASH_SECRET", _DEFAULT_HASH_SECRET)


def hash_identifier(value: str | int | None, secret: str | None = None, namespace: str = "") -> str:
    normalized = "" if value is None else str(value)
    key = (secret or get_hash_secret()).encode("utf-8")
    message = f"{namespace}:{normalized}".encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()
