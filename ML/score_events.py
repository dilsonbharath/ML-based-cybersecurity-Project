from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    import joblib
    import numpy as np
    import pandas as pd
    from catboost import CatBoostClassifier  # type: ignore[import-not-found]
except Exception as exc:  # pragma: no cover - handled at runtime
    raise RuntimeError(
        "Missing ML dependencies. Install packages from ML/requirements.txt before running this script."
    ) from exc

from features import build_feature_frame, compute_rule_score, to_iforest_frame

BASE_DIR = Path(__file__).resolve().parent


def _normalize(values: np.ndarray, min_value: float, max_value: float) -> np.ndarray:
    span = max(max_value - min_value, 1e-9)
    return np.clip((values - min_value) / span, 0.0, 1.0)


def _risk_band(risk_score: float, suspicious_threshold: float, anomaly_threshold: float) -> str:
    if risk_score >= anomaly_threshold:
        return "anomaly"
    if risk_score >= suspicious_threshold:
        return "suspicious"
    return "normal"


def _reason_codes(row: pd.Series) -> str:
    reasons: list[str] = []
    if row["in_shift_flag"] == 0 and row["patient_record_read_count"] >= 12:
        reasons.append("off_shift_record_access")
    if row["denied_count"] >= 4:
        reasons.append("repeated_denied_access")
    if row["unique_patients_accessed"] >= 35:
        reasons.append("bulk_patient_access")
    if row["concurrent_session_count"] >= 4:
        reasons.append("concurrent_sessions_spike")
    if row["role"] == "Nurse" and row["nurse_unassigned_access_ratio"] >= 0.50:
        reasons.append("nurse_unassigned_access_pattern")
    if row["role"] == "registration_desk" and row["regdesk_clinical_read_ratio"] >= 0.50:
        reasons.append("regdesk_deep_clinical_reads")
    if row["ip_change_flag"] == 1:
        reasons.append("ip_change")
    if row["user_agent_change_flag"] == 1:
        reasons.append("user_agent_change")
    if not reasons:
        reasons.append("baseline_pattern")
    return "|".join(reasons)


def score_events(input_path: Path, artifacts_dir: Path, output_path: Path) -> pd.DataFrame:
    meta_path = artifacts_dir / "model_meta.json"
    cat_model_path = artifacts_dir / "catboost_model.cbm"
    iso_model_path = artifacts_dir / "isolation_forest.joblib"

    if not meta_path.exists() or not cat_model_path.exists() or not iso_model_path.exists():
        raise FileNotFoundError("Missing model artifacts. Run train_models.py first.")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    score_weights = meta["score_weights"]
    thresholds = meta["risk_thresholds"]
    iforest_scale = meta["iforest_scale"]

    cat_model = CatBoostClassifier()
    cat_model.load_model(str(cat_model_path))
    iso_model = joblib.load(iso_model_path)

    raw_frame = pd.read_csv(input_path)
    frame = build_feature_frame(raw_frame)

    feature_columns = meta["feature_columns"]
    x_frame = frame[feature_columns].copy()

    cat_prob = cat_model.predict_proba(x_frame)
    try:
        classes_raw = getattr(cat_model, "classes_", None)
        classes = [int(value) for value in classes_raw] if classes_raw is not None else []
        anomaly_index = classes.index(2) if classes else 2
    except Exception:
        anomaly_index = 2
    cat_anomaly_prob = cat_prob[:, anomaly_index]

    iso_frame = to_iforest_frame(frame, feature_columns=feature_columns, categorical_columns=meta["categorical_columns"])
    iso_raw = -iso_model.decision_function(iso_frame)
    iso_prob = _normalize(iso_raw, float(iforest_scale["min"]), float(iforest_scale["max"]))

    rule_prob = compute_rule_score(frame) / 100.0
    combined_prob = (
        score_weights["rules"] * rule_prob
        + score_weights["catboost"] * cat_anomaly_prob
        + score_weights["isolation_forest"] * iso_prob
    )
    risk_score = np.clip(combined_prob * 100.0, 0.0, 100.0)

    scored = frame.copy()
    scored["catboost_anomaly_prob"] = cat_anomaly_prob
    scored["iforest_anomaly_prob"] = iso_prob
    scored["ensemble_prob"] = combined_prob
    scored["risk_score"] = risk_score
    scored["risk_band"] = scored["risk_score"].apply(
        lambda value: _risk_band(
            risk_score=float(value),
            suspicious_threshold=float(thresholds["suspicious"]),
            anomaly_threshold=float(thresholds["anomaly"]),
        )
    )
    scored["reason_codes"] = scored.apply(_reason_codes, axis=1)

    output_columns = [
        "event_time",
        "role",
        "shift_slot",
        "hashed_user_id",
        "hashed_patient_id",
        "hashed_session_id",
        "hashed_ip",
        "hashed_request_id",
        "risk_score",
        "risk_band",
        "reason_codes",
        "catboost_anomaly_prob",
        "iforest_anomaly_prob",
        "ensemble_prob",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_frame = pd.DataFrame(scored.loc[:, output_columns]).copy()
    output_frame.to_csv(output_path, index=False)
    return output_frame


def _build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score activity events with trained ensemble artifacts.")
    parser.add_argument(
        "--input",
        type=Path,
        default=BASE_DIR / "data" / "synthetic_activity.csv",
        help="Input CSV path.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=BASE_DIR / "artifacts",
        help="Model artifacts path.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=BASE_DIR / "data" / "scored_activity.csv",
        help="Output scored CSV path.",
    )
    return parser.parse_args()


def main() -> None:
    args = _build_args()
    scored = score_events(
        input_path=args.input,
        artifacts_dir=args.artifacts_dir,
        output_path=args.output,
    )
    print(f"Scored rows: {len(scored)}")
    print(f"Saved scored output: {args.output}")


if __name__ == "__main__":
    main()
