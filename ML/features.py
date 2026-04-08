from __future__ import annotations

from typing import Iterable

try:
    import numpy as np
    import pandas as pd
except Exception as exc:  # pragma: no cover - handled at runtime
    raise RuntimeError(
        "Missing ML dependencies. Install packages from ML/requirements.txt before running this script."
    ) from exc

LABEL_TO_ID = {"normal": 0, "suspicious": 1, "anomaly": 2}
ID_TO_LABEL = {value: key for key, value in LABEL_TO_ID.items()}

FEATURE_COLUMNS = [
    "role",
    "shift_slot",
    "hour_of_day",
    "day_of_week",
    "weekend_flag",
    "in_shift_flag",
    "offshift_access_ratio",
    "total_requests_window",
    "read_count",
    "write_count",
    "denied_count",
    "unique_patients_accessed",
    "patient_search_count",
    "patient_record_read_count",
    "appointment_linked_access_ratio",
    "read_write_ratio",
    "failed_auth_ratio",
    "concurrent_session_count",
    "ip_change_flag",
    "user_agent_change_flag",
    "nurse_unassigned_access_ratio",
    "regdesk_clinical_read_ratio",
    "role_hour_read_z",
    "role_hour_unique_z",
    "user_read_ratio",
    "user_unique_ratio",
    "user_denied_ratio",
    "role_shift_offshift_gap",
]

CATEGORICAL_FEATURE_COLUMNS = ["role", "shift_slot", "day_of_week"]


NUMERIC_FEATURE_COLUMNS = [
    col for col in FEATURE_COLUMNS if col not in CATEGORICAL_FEATURE_COLUMNS
]


def build_feature_frame(raw_frame: pd.DataFrame) -> pd.DataFrame:
    frame = raw_frame.copy()

    frame["event_time"] = pd.to_datetime(frame["event_time"], utc=True, errors="coerce")
    frame = frame.dropna(subset=["event_time"]).reset_index(drop=True)

    frame["hour_of_day"] = frame["event_time"].dt.hour.astype(int)
    frame["day_of_week"] = frame["event_time"].dt.day_name().str[:3]
    frame["weekend_flag"] = frame["event_time"].dt.dayofweek.isin([5, 6]).astype(int)

    if "hashed_user_id" not in frame.columns:
        if "user_id" in frame.columns:
            frame["hashed_user_id"] = frame["user_id"].astype(str)
        else:
            frame["hashed_user_id"] = "unknown-user"

    for column in NUMERIC_FEATURE_COLUMNS:
        if column not in frame.columns:
            frame[column] = 0.0

    frame["read_write_ratio"] = np.where(
        (frame["write_count"] > 0),
        frame["read_count"] / frame["write_count"],
        frame["read_count"],
    )
    frame["failed_auth_ratio"] = np.where(
        frame["total_requests_window"] > 0,
        frame["denied_count"] / frame["total_requests_window"],
        0.0,
    )

    for column in NUMERIC_FEATURE_COLUMNS:
        numeric_series = pd.to_numeric(frame[column], errors="coerce")
        frame[column] = numeric_series.fillna(0.0)  # type: ignore[union-attr]

    for column in CATEGORICAL_FEATURE_COLUMNS:
        frame[column] = frame[column].astype(str).fillna("unknown")

    # Role+hour baselines capture how unusual an event is against peer behavior.
    role_hour_group = frame.groupby(["role", "hour_of_day"], dropna=False)
    role_hour_read_mean = role_hour_group["read_count"].transform("mean")
    role_hour_read_std = role_hour_group["read_count"].transform("std").replace(0.0, np.nan)
    role_hour_unique_mean = role_hour_group["unique_patients_accessed"].transform("mean")
    role_hour_unique_std = role_hour_group["unique_patients_accessed"].transform("std").replace(0.0, np.nan)

    frame["role_hour_read_z"] = (
        (frame["read_count"] - role_hour_read_mean) / role_hour_read_std
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0).clip(-6.0, 6.0)
    frame["role_hour_unique_z"] = (
        (frame["unique_patients_accessed"] - role_hour_unique_mean) / role_hour_unique_std
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0).clip(-6.0, 6.0)

    # User baselines track drift from a user's own historical activity pattern.
    user_group = frame.groupby("hashed_user_id", dropna=False)
    user_read_mean = user_group["read_count"].transform("mean")
    user_unique_mean = user_group["unique_patients_accessed"].transform("mean")
    user_denied_mean = user_group["denied_count"].transform("mean")

    frame["user_read_ratio"] = frame["read_count"] / np.maximum(user_read_mean, 1.0)
    frame["user_unique_ratio"] = frame["unique_patients_accessed"] / np.maximum(user_unique_mean, 1.0)
    frame["user_denied_ratio"] = frame["denied_count"] / np.maximum(user_denied_mean, 1.0)

    role_shift_group = frame.groupby(["role", "shift_slot"], dropna=False)
    role_shift_offshift_mean = role_shift_group["offshift_access_ratio"].transform("mean")
    frame["role_shift_offshift_gap"] = frame["offshift_access_ratio"] - role_shift_offshift_mean

    ratio_columns = [
        "user_read_ratio",
        "user_unique_ratio",
        "user_denied_ratio",
    ]
    for column in ratio_columns:
        frame[column] = frame[column].replace([np.inf, -np.inf], np.nan).fillna(0.0).clip(0.0, 10.0)

    frame["role_shift_offshift_gap"] = frame["role_shift_offshift_gap"].replace([np.inf, -np.inf], np.nan).fillna(0.0).clip(-1.0, 1.0)

    if "label" in frame.columns:
        frame["label"] = frame["label"].astype(str)
        frame["label_id"] = frame["label"].map(LABEL_TO_ID).fillna(0).astype(int)

    return frame


def compute_rule_score(frame: pd.DataFrame) -> np.ndarray:
    hard_score = np.zeros(len(frame), dtype=float)

    hard_score += np.where(
        (frame["in_shift_flag"] == 0) & (frame["patient_record_read_count"] >= 12),
        35.0,
        0.0,
    )
    hard_score += np.where(frame["denied_count"] >= 4, 20.0, 0.0)
    hard_score += np.where(frame["unique_patients_accessed"] >= 35, 25.0, 0.0)
    hard_score += np.where(frame["concurrent_session_count"] >= 4, 15.0, 0.0)

    nurse_soft = 0.5 * frame["nurse_unassigned_access_ratio"].to_numpy(dtype=float) * 100.0
    regdesk_soft = 0.5 * frame["regdesk_clinical_read_ratio"].to_numpy(dtype=float) * 100.0

    score = np.clip(hard_score + nurse_soft + regdesk_soft, 0.0, 100.0)
    return score


def to_iforest_frame(
    frame: pd.DataFrame,
    feature_columns: Iterable[str] = FEATURE_COLUMNS,
    categorical_columns: Iterable[str] = CATEGORICAL_FEATURE_COLUMNS,
) -> pd.DataFrame:
    result = pd.DataFrame(frame.loc[:, list(feature_columns)]).copy()
    for column in categorical_columns:
        result[column] = result[column].astype("category").cat.codes.astype(float)
    return result
