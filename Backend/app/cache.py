import json
import os
from typing import Any

try:
    import redis
except Exception:  # pragma: no cover
    redis = None

_CACHE_CLIENT = None
_CACHE_PREFIX = "ehr-cache:v1:"


def _get_client():
    global _CACHE_CLIENT
    if _CACHE_CLIENT is not None:
        return _CACHE_CLIENT

    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url or redis is None:
        _CACHE_CLIENT = False
        return None

    try:
        client = redis.Redis.from_url(redis_url, decode_responses=True)
        client.ping()
        _CACHE_CLIENT = client
        return client
    except Exception:
        _CACHE_CLIENT = False
        return None


def make_cache_key(*parts: Any) -> str:
    serialized = "|".join(str(part) for part in parts)
    return f"{_CACHE_PREFIX}{serialized}"


def get_cached_json(key: str):
    client = _get_client()
    if client is None:
        return None

    try:
        raw = client.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


def set_cached_json(key: str, value: Any, ttl_seconds: int = 15) -> None:
    client = _get_client()
    if client is None:
        return

    try:
        payload = json.dumps(value)
        client.setex(key, max(1, ttl_seconds), payload)
    except Exception:
        return


def invalidate_cache_prefix(prefix_suffix: str = "") -> None:
    client = _get_client()
    if client is None:
        return

    pattern = f"{_CACHE_PREFIX}{prefix_suffix}*"
    try:
        cursor = 0
        while True:
            cursor, keys = client.scan(cursor=cursor, match=pattern, count=200)
            if keys:
                client.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        return


def invalidate_all_cache() -> None:
    invalidate_cache_prefix("")
