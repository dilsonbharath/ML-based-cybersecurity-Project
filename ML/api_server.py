from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier  # type: ignore[import-not-found]
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from features import build_feature_frame, compute_rule_score, to_iforest_frame
from hashing import get_hash_secret, hash_identifier

BASE_DIR = Path(__file__).resolve().parent


class ScoreEventInput(BaseModel):
    event_time: str | None = None
    role: str = Field(default="Administrator")
    shift_slot: str | None = Field(default="10-18")
    in_shift_flag: int | None = None

    # Hashed IDs can be sent directly. If omitted, raw values are hashed below.
    hashed_user_id: str | None = None
    hashed_patient_id: str | None = None
    hashed_session_id: str | None = None
    hashed_ip: str | None = None
    hashed_request_id: str | None = None

    user_id: str | int | None = None
    patient_id: str | int | None = None
    session_id: str | int | None = None
    ip_address: str | None = None
    request_id: str | int | None = None

    read_count: int = 0
    write_count: int = 0
    denied_count: int = 0
    total_requests_window: int | None = None
    unique_patients_accessed: int = 0
    patient_search_count: int = 0
    patient_record_read_count: int = 0
    appointment_linked_access_ratio: float = 0.0
    offshift_access_ratio: float = 0.0
    concurrent_session_count: int = 1
    ip_change_flag: int = 0
    user_agent_change_flag: int = 0
    nurse_unassigned_access_ratio: float = 0.0
    regdesk_clinical_read_ratio: float = 0.0
    read_write_ratio: float | None = None
    failed_auth_ratio: float | None = None


class ScoreBatchRequest(BaseModel):
    events: list[ScoreEventInput]
    source: str | None = None


class _Scorer:
    def __init__(self, artifacts_dir: Path):
        self.artifacts_dir = artifacts_dir
        self.meta: dict[str, Any] = {}
        self.cat_model: CatBoostClassifier | None = None
        self.iso_model: Any = None

    def load(self) -> None:
        meta_path = self.artifacts_dir / "model_meta.json"
        cat_model_path = self.artifacts_dir / "catboost_model.cbm"
        iso_model_path = self.artifacts_dir / "isolation_forest.joblib"

        if not meta_path.exists() or not cat_model_path.exists() or not iso_model_path.exists():
            raise RuntimeError("Missing model artifacts. Train the model before starting API server.")

        self.meta = json.loads(meta_path.read_text(encoding="utf-8"))
        self.cat_model = CatBoostClassifier()
        self.cat_model.load_model(str(cat_model_path))
        self.iso_model = joblib.load(iso_model_path)

    @staticmethod
    def _is_in_shift(shift_slot: str | None, hour: int) -> int:
        if shift_slot == "2-10":
            return int(2 <= hour < 10)
        if shift_slot == "10-18":
            return int(10 <= hour < 18)
        if shift_slot == "18-2":
            return int(hour >= 18 or hour < 2)
        return 1

    @staticmethod
    def _risk_band(risk_score: float, suspicious_threshold: float, anomaly_threshold: float) -> str:
        if risk_score >= anomaly_threshold:
            return "anomaly"
        if risk_score >= suspicious_threshold:
            return "suspicious"
        return "normal"

    @staticmethod
    def _reason_codes(row: pd.Series) -> str:
        reasons: list[str] = []
        if row.get("in_shift_flag", 1) == 0 and row.get("patient_record_read_count", 0) >= 12:
            reasons.append("off_shift_record_access")
        if row.get("denied_count", 0) >= 4:
            reasons.append("repeated_denied_access")
        if row.get("unique_patients_accessed", 0) >= 35:
            reasons.append("bulk_patient_access")
        if row.get("concurrent_session_count", 0) >= 4:
            reasons.append("concurrent_sessions_spike")
        if row.get("role") == "Nurse" and row.get("nurse_unassigned_access_ratio", 0.0) >= 0.50:
            reasons.append("nurse_unassigned_access_pattern")
        if row.get("role") == "registration_desk" and row.get("regdesk_clinical_read_ratio", 0.0) >= 0.50:
            reasons.append("regdesk_deep_clinical_reads")
        if row.get("ip_change_flag", 0) == 1:
            reasons.append("ip_change")
        if row.get("user_agent_change_flag", 0) == 1:
            reasons.append("user_agent_change")
        if not reasons:
            reasons.append("baseline_pattern")
        return "|".join(reasons)

    @staticmethod
    def _normalize(values: np.ndarray, min_value: float, max_value: float) -> np.ndarray:
        span = max(max_value - min_value, 1e-9)
        return np.clip((values - min_value) / span, 0.0, 1.0)

    def _normalize_events(self, events: list[ScoreEventInput]) -> pd.DataFrame:
        secret = get_hash_secret()
        rows: list[dict[str, Any]] = []

        for event in events:
            payload = event.model_dump()
            now_utc = datetime.now(timezone.utc)
            parsed_time = payload.get("event_time")
            if not parsed_time:
                event_time = now_utc.isoformat().replace("+00:00", "Z")
                hour = now_utc.hour
            else:
                event_dt = pd.to_datetime(parsed_time, utc=True, errors="coerce")
                if pd.isna(event_dt):
                    event_time = now_utc.isoformat().replace("+00:00", "Z")
                    hour = now_utc.hour
                else:
                    ts = pd.Timestamp(event_dt)
                    event_time = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
                    hour = int(ts.hour)

            role = str(payload.get("role") or "Administrator")
            shift_slot = payload.get("shift_slot") or "10-18"

            read_count = int(payload.get("read_count") or 0)
            write_count = int(payload.get("write_count") or 0)
            denied_count = int(payload.get("denied_count") or 0)
            total_requests_window = payload.get("total_requests_window")
            if total_requests_window is None:
                total_requests_window = read_count + write_count + denied_count

            read_write_ratio = payload.get("read_write_ratio")
            if read_write_ratio is None:
                read_write_ratio = float(read_count / max(1, write_count))

            failed_auth_ratio = payload.get("failed_auth_ratio")
            if failed_auth_ratio is None:
                failed_auth_ratio = float(denied_count / max(1, int(total_requests_window)))

            in_shift_flag = payload.get("in_shift_flag")
            if in_shift_flag is None:
                in_shift_flag = self._is_in_shift(str(shift_slot), hour)

            user_source = payload.get("user_id") or payload.get("hashed_user_id") or "unknown-user"
            patient_source = payload.get("patient_id") or payload.get("hashed_patient_id") or "unknown-patient"
            session_source = payload.get("session_id") or payload.get("hashed_session_id") or f"session-{user_source}"
            ip_source = payload.get("ip_address") or payload.get("hashed_ip") or "0.0.0.0"
            request_source = payload.get("request_id") or payload.get("hashed_request_id") or f"request-{user_source}"

            row = {
                "event_time": event_time,
                "role": role,
                "shift_slot": shift_slot,
                "in_shift_flag": int(in_shift_flag),
                "hashed_user_id": payload.get("hashed_user_id") or hash_identifier(user_source, secret=secret, namespace="user"),
                "hashed_patient_id": payload.get("hashed_patient_id") or hash_identifier(patient_source, secret=secret, namespace="patient"),
                "hashed_session_id": payload.get("hashed_session_id") or hash_identifier(session_source, secret=secret, namespace="session"),
                "hashed_ip": payload.get("hashed_ip") or hash_identifier(ip_source, secret=secret, namespace="ip"),
                "hashed_request_id": payload.get("hashed_request_id") or hash_identifier(request_source, secret=secret, namespace="request"),
                "read_count": read_count,
                "write_count": write_count,
                "denied_count": denied_count,
                "total_requests_window": int(total_requests_window),
                "unique_patients_accessed": int(payload.get("unique_patients_accessed") or 0),
                "patient_search_count": int(payload.get("patient_search_count") or 0),
                "patient_record_read_count": int(payload.get("patient_record_read_count") or 0),
                "appointment_linked_access_ratio": float(payload.get("appointment_linked_access_ratio") or 0.0),
                "offshift_access_ratio": float(payload.get("offshift_access_ratio") or 0.0),
                "concurrent_session_count": int(payload.get("concurrent_session_count") or 1),
                "ip_change_flag": int(payload.get("ip_change_flag") or 0),
                "user_agent_change_flag": int(payload.get("user_agent_change_flag") or 0),
                "nurse_unassigned_access_ratio": float(payload.get("nurse_unassigned_access_ratio") or 0.0),
                "regdesk_clinical_read_ratio": float(payload.get("regdesk_clinical_read_ratio") or 0.0),
                "read_write_ratio": float(read_write_ratio),
                "failed_auth_ratio": float(failed_auth_ratio),
            }
            rows.append(row)

        return pd.DataFrame(rows)

    def score(self, events: list[ScoreEventInput]) -> list[dict[str, Any]]:
        if self.cat_model is None or self.iso_model is None:
            raise RuntimeError("Scoring model is not loaded.")
        if not events:
            return []

        base_frame = self._normalize_events(events)
        frame = build_feature_frame(base_frame)

        feature_columns = self.meta["feature_columns"]
        categorical_columns = self.meta["categorical_columns"]
        score_weights = self.meta["score_weights"]
        thresholds = self.meta["risk_thresholds"]
        iforest_scale = self.meta["iforest_scale"]

        x_frame = frame[feature_columns].copy()
        cat_prob = self.cat_model.predict_proba(x_frame)

        classes_raw = getattr(self.cat_model, "classes_", None)
        classes = [int(value) for value in classes_raw] if classes_raw is not None else []
        anomaly_index = classes.index(2) if classes else 2
        cat_anomaly_prob = cat_prob[:, anomaly_index]

        iso_frame = to_iforest_frame(frame, feature_columns=feature_columns, categorical_columns=categorical_columns)
        iso_raw = -self.iso_model.decision_function(iso_frame)
        iso_prob = self._normalize(iso_raw, float(iforest_scale["min"]), float(iforest_scale["max"]))

        rule_prob = compute_rule_score(frame) / 100.0
        combined_prob = (
            (float(score_weights["rules"]) * rule_prob)
            + (float(score_weights["catboost"]) * cat_anomaly_prob)
            + (float(score_weights["isolation_forest"]) * iso_prob)
        )
        risk_score = np.clip(combined_prob * 100.0, 0.0, 100.0)

        scored = frame.copy()
        scored["catboost_anomaly_prob"] = cat_anomaly_prob
        scored["iforest_anomaly_prob"] = iso_prob
        scored["ensemble_prob"] = combined_prob
        scored["risk_score"] = risk_score
        scored["risk_band"] = scored["risk_score"].apply(
            lambda value: self._risk_band(
                risk_score=float(value),
                suspicious_threshold=float(thresholds["suspicious"]),
                anomaly_threshold=float(thresholds["anomaly"]),
            )
        )
        scored["reason_codes"] = scored.apply(self._reason_codes, axis=1)

        results: list[dict[str, Any]] = []
        for row in scored.to_dict(orient="records"):
            results.append(
                {
                    "event_time": row["event_time"],
                    "role": row["role"],
                    "shift_slot": row["shift_slot"],
                    "hashed_user_id": row["hashed_user_id"],
                    "hashed_patient_id": row["hashed_patient_id"],
                    "risk_score": float(row["risk_score"]),
                    "risk_band": row["risk_band"],
                    "reason_codes": row["reason_codes"],
                    "catboost_anomaly_prob": float(row["catboost_anomaly_prob"]),
                    "iforest_anomaly_prob": float(row["iforest_anomaly_prob"]),
                    "ensemble_prob": float(row["ensemble_prob"]),
                }
            )
        return results


ARTIFACTS_DIR = Path(os.getenv("ML_ARTIFACTS_DIR", BASE_DIR / "artifacts"))
SCORER = _Scorer(artifacts_dir=ARTIFACTS_DIR)

app = FastAPI(title="Insider Threat ML Service", version="1.0.0")


@app.on_event("startup")
def startup() -> None:
    SCORER.load()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "insider-threat-ml",
        "artifacts_dir": str(ARTIFACTS_DIR),
    }


@app.post("/score/batch")
def score_batch(payload: ScoreBatchRequest) -> dict[str, Any]:
    try:
        results = SCORER.score(payload.events)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Scoring failed: {exc}") from exc

    return {
        "count": len(results),
        "source": payload.source,
        "results": results,
    }
