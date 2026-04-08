from __future__ import annotations

import os
from typing import Any

import httpx


class MLClientError(RuntimeError):
    pass


def _base_url() -> str:
    return os.getenv("ML_SERVICE_URL", "http://127.0.0.1:8100").rstrip("/")


def _timeout_seconds() -> float:
    try:
        value = float(os.getenv("ML_SERVICE_TIMEOUT", "10"))
    except ValueError:
        value = 10.0
    return max(1.0, value)


def healthcheck() -> dict[str, Any]:
    url = f"{_base_url()}/health"
    try:
        with httpx.Client(timeout=_timeout_seconds()) as client:
            response = client.get(url)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise MLClientError(f"ML service health endpoint failed: {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise MLClientError(f"ML service health endpoint unreachable: {exc}") from exc

    payload = response.json()
    if not isinstance(payload, dict):
        raise MLClientError("ML health response is invalid")
    return payload


def score_events(events: list[dict[str, Any]], source: str = "backend_operation_logs") -> list[dict[str, Any]]:
    if not events:
        return []

    url = f"{_base_url()}/score/batch"
    body = {
        "source": source,
        "events": events,
    }

    try:
        with httpx.Client(timeout=_timeout_seconds()) as client:
            response = client.post(url, json=body)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or "unknown response"
        raise MLClientError(f"ML scoring failed ({exc.response.status_code}): {detail}") from exc
    except httpx.HTTPError as exc:
        raise MLClientError(f"ML scoring endpoint unreachable: {exc}") from exc

    payload = response.json()
    if not isinstance(payload, dict):
        raise MLClientError("ML scoring response is invalid")

    results = payload.get("results")
    if not isinstance(results, list):
        raise MLClientError("ML scoring response is missing results list")
    return results
