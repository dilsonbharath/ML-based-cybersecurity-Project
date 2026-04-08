from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
except Exception as exc:  # pragma: no cover - handled at runtime
    raise RuntimeError(
        "Missing ML dependencies. Install packages from ML/requirements.txt before running this script."
    ) from exc

from hashing import get_hash_secret, hash_identifier

BASE_DIR = Path(__file__).resolve().parent
ROLE_MIX = {
    "Nurse": 0.40,
    "Doctor": 0.30,
    "registration_desk": 0.20,
    "Administrator": 0.10,
}
SHIFT_SLOTS = ["2-10", "10-18", "18-2"]
SCENARIOS = ["normal", "busy_normal", "suspicious", "anomaly"]
SCENARIO_PROBS = [0.70, 0.12, 0.10, 0.08]


@dataclass
class SyntheticConfig:
    rows: int = 12000
    days: int = 30
    users: int = 180
    seed: int = 42
    output_path: Path = BASE_DIR / "data" / "synthetic_activity.csv"


def _role_for_index(index: int, total: int) -> str:
    ratio = index / max(total, 1)
    if ratio < ROLE_MIX["Nurse"]:
        return "Nurse"
    if ratio < ROLE_MIX["Nurse"] + ROLE_MIX["Doctor"]:
        return "Doctor"
    if ratio < ROLE_MIX["Nurse"] + ROLE_MIX["Doctor"] + ROLE_MIX["registration_desk"]:
        return "registration_desk"
    return "Administrator"


def _is_in_shift(slot: str, hour: int) -> bool:
    if slot == "2-10":
        return 2 <= hour < 10
    if slot == "10-18":
        return 10 <= hour < 18
    return hour >= 18 or hour < 2


def _hours_in_shift(slot: str) -> list[int]:
    if slot == "2-10":
        return list(range(2, 10))
    if slot == "10-18":
        return list(range(10, 18))
    return [18, 19, 20, 21, 22, 23, 0, 1]


def _hours_outside_shift(slot: str) -> list[int]:
    in_shift = set(_hours_in_shift(slot))
    return [hour for hour in range(24) if hour not in in_shift]


def _build_user_pool(config: SyntheticConfig, rng: np.random.Generator) -> list[dict[str, str | int]]:
    users: list[dict[str, str | int]] = []
    for user_id in range(1, config.users + 1):
        role = _role_for_index(user_id - 1, config.users)
        shift_slot = rng.choice(SHIFT_SLOTS) if role != "Administrator" else "10-18"
        users.append(
            {
                "user_id": user_id,
                "role": role,
                "shift_slot": str(shift_slot),
            }
        )
    rng.shuffle(users)
    return users


def _sample_hour(slot: str, scenario: str, rng: np.random.Generator) -> int:
    if scenario in {"normal", "busy_normal"}:
        in_shift = rng.random() < 0.87
    elif scenario == "suspicious":
        in_shift = rng.random() < 0.58
    else:
        in_shift = rng.random() < 0.40

    hours = _hours_in_shift(slot) if in_shift else _hours_outside_shift(slot)
    return int(rng.choice(hours))


def _role_baseline(role: str) -> dict[str, float]:
    if role == "Doctor":
        return {"read": 16.0, "write": 4.0, "unique": 10.0}
    if role == "Nurse":
        return {"read": 14.0, "write": 3.0, "unique": 9.0}
    if role == "registration_desk":
        return {"read": 18.0, "write": 2.0, "unique": 14.0}
    return {"read": 6.0, "write": 2.0, "unique": 4.0}


def _scenario_multiplier(scenario: str) -> tuple[float, float, float]:
    if scenario == "normal":
        return (1.0, 1.0, 1.0)
    if scenario == "busy_normal":
        return (1.4, 1.25, 1.3)
    if scenario == "suspicious":
        return (1.8, 0.9, 2.3)
    return (2.6, 0.7, 3.2)


def _clip(value: float, low: float, high: float) -> float:
    return float(max(low, min(high, value)))


def _sample_behavior(role: str, scenario: str, in_shift_flag: int, rng: np.random.Generator) -> dict[str, float | int]:
    baseline = _role_baseline(role)
    read_m, write_m, unique_m = _scenario_multiplier(scenario)

    read_count = int(max(0, rng.poisson(baseline["read"] * read_m)))
    write_count = int(max(0, rng.poisson(max(0.5, baseline["write"] * write_m))))

    if scenario == "normal":
        denied_count = int(rng.binomial(1, 0.03))
    elif scenario == "busy_normal":
        denied_count = int(rng.binomial(2, 0.07))
    elif scenario == "suspicious":
        denied_count = int(rng.binomial(5, 0.28))
    else:
        denied_count = int(rng.binomial(8, 0.42))

    unique_patients = int(max(1, rng.normal(baseline["unique"] * unique_m, 2.8)))
    unique_patients = min(unique_patients, max(1, read_count + 2))

    if scenario == "normal":
        appointment_linked_ratio = _clip(rng.normal(0.82, 0.08), 0.45, 1.0)
    elif scenario == "busy_normal":
        appointment_linked_ratio = _clip(rng.normal(0.75, 0.10), 0.35, 1.0)
    elif scenario == "suspicious":
        appointment_linked_ratio = _clip(rng.normal(0.45, 0.16), 0.0, 0.9)
    else:
        appointment_linked_ratio = _clip(rng.normal(0.28, 0.17), 0.0, 0.8)

    patient_search_count = int(max(0, round(read_count * rng.uniform(0.18, 0.55))))
    patient_record_read_count = int(max(0, round(read_count * rng.uniform(0.30, 0.85))))

    offshift_access_ratio = _clip(
        rng.normal(0.06, 0.05) if in_shift_flag else rng.normal(0.65, 0.20),
        0.0,
        1.0,
    )

    if scenario == "normal":
        concurrent_session_count = int(max(1, rng.poisson(1.1)))
    elif scenario == "busy_normal":
        concurrent_session_count = int(max(1, rng.poisson(1.4)))
    elif scenario == "suspicious":
        concurrent_session_count = int(max(1, rng.poisson(2.2)))
    else:
        concurrent_session_count = int(max(1, rng.poisson(3.3)))

    ip_change_flag = int(rng.random() < (0.05 if scenario == "normal" else 0.35 if scenario == "suspicious" else 0.55 if scenario == "anomaly" else 0.12))
    user_agent_change_flag = int(
        rng.random() < (0.04 if scenario == "normal" else 0.27 if scenario == "suspicious" else 0.45 if scenario == "anomaly" else 0.10)
    )

    nurse_unassigned_access_ratio = 0.0
    regdesk_clinical_read_ratio = 0.0
    if role == "Nurse":
        if scenario == "normal":
            nurse_unassigned_access_ratio = _clip(rng.normal(0.14, 0.08), 0.0, 0.45)
        elif scenario == "busy_normal":
            nurse_unassigned_access_ratio = _clip(rng.normal(0.24, 0.10), 0.0, 0.60)
        elif scenario == "suspicious":
            nurse_unassigned_access_ratio = _clip(rng.normal(0.56, 0.14), 0.05, 1.0)
        else:
            nurse_unassigned_access_ratio = _clip(rng.normal(0.76, 0.12), 0.15, 1.0)

    if role == "registration_desk":
        if scenario == "normal":
            regdesk_clinical_read_ratio = _clip(rng.normal(0.10, 0.07), 0.0, 0.40)
        elif scenario == "busy_normal":
            regdesk_clinical_read_ratio = _clip(rng.normal(0.20, 0.10), 0.0, 0.55)
        elif scenario == "suspicious":
            regdesk_clinical_read_ratio = _clip(rng.normal(0.50, 0.14), 0.08, 0.95)
        else:
            regdesk_clinical_read_ratio = _clip(rng.normal(0.72, 0.12), 0.20, 1.0)

    total_requests = int(read_count + write_count + denied_count)
    read_write_ratio = float(read_count / max(1, write_count))
    failed_auth_ratio = float(denied_count / max(1, total_requests))

    return {
        "read_count": read_count,
        "write_count": write_count,
        "denied_count": denied_count,
        "total_requests_window": total_requests,
        "unique_patients_accessed": unique_patients,
        "patient_search_count": patient_search_count,
        "patient_record_read_count": patient_record_read_count,
        "appointment_linked_access_ratio": appointment_linked_ratio,
        "offshift_access_ratio": offshift_access_ratio,
        "concurrent_session_count": concurrent_session_count,
        "ip_change_flag": ip_change_flag,
        "user_agent_change_flag": user_agent_change_flag,
        "nurse_unassigned_access_ratio": nurse_unassigned_access_ratio,
        "regdesk_clinical_read_ratio": regdesk_clinical_read_ratio,
        "read_write_ratio": read_write_ratio,
        "failed_auth_ratio": failed_auth_ratio,
    }


def _rule_score(row: pd.Series) -> float:
    hard = 0.0
    if row["in_shift_flag"] == 0 and row["patient_record_read_count"] >= 12:
        hard += 35.0
    if row["denied_count"] >= 4:
        hard += 20.0
    if row["unique_patients_accessed"] >= 35:
        hard += 25.0
    if row["concurrent_session_count"] >= 4:
        hard += 15.0

    soft = 0.5 * (row["nurse_unassigned_access_ratio"] * 100.0)
    soft += 0.5 * (row["regdesk_clinical_read_ratio"] * 100.0)
    return _clip(hard + soft, 0.0, 100.0)


def _behavior_score(row: pd.Series, scenario: str, rng: np.random.Generator) -> float:
    base = {
        "normal": 18.0,
        "busy_normal": 30.0,
        "suspicious": 50.0,
        "anomaly": 70.0,
    }[scenario]
    dynamic = 0.0
    dynamic += max(0.0, row["read_count"] - 18.0) * 0.45
    dynamic += max(0.0, row["unique_patients_accessed"] - 14.0) * 0.55
    dynamic += max(0.0, row["denied_count"] - 1.0) * 2.6
    if row["in_shift_flag"] == 0:
        dynamic += 7.5
    dynamic += rng.normal(0.0, 5.0)
    return _clip(base + dynamic, 0.0, 100.0)


def _label_from_risk(risk_score: float) -> str:
    if risk_score >= 70.0:
        return "anomaly"
    if risk_score >= 40.0:
        return "suspicious"
    return "normal"


def _inject_label_noise(df: pd.DataFrame, rng: np.random.Generator, rate: float = 0.03) -> None:
    count = int(len(df) * rate)
    if count <= 0:
        return
    candidates = rng.choice(df.index.to_numpy(), size=count, replace=False)
    for idx in candidates:
        current = str(df.at[idx, "label"])
        if current == "normal":
            df.at[idx, "label"] = "suspicious"
        elif current == "anomaly":
            df.at[idx, "label"] = "suspicious"
        else:
            df.at[idx, "label"] = "normal" if rng.random() < 0.5 else "anomaly"


def _rebalance_label_ranges(df: pd.DataFrame) -> None:
    total = len(df)
    if total == 0:
        return

    min_anomaly = int(0.06 * total)
    max_anomaly = int(0.10 * total)
    min_suspicious = int(0.10 * total)
    max_suspicious = int(0.18 * total)

    anomaly_mask = df["label"] == "anomaly"
    suspicious_mask = df["label"] == "suspicious"

    anomaly_count = int(anomaly_mask.sum())
    suspicious_count = int(suspicious_mask.sum())

    if anomaly_count < min_anomaly:
        needed = min_anomaly - anomaly_count
        promote = (
            df[df["label"] == "suspicious"]
            .sort_values(by="risk_score", ascending=False)  # type: ignore[call-arg]
            .head(needed)
            .index
        )
        df.loc[promote, "label"] = "anomaly"
    elif anomaly_count > max_anomaly:
        extra = anomaly_count - max_anomaly
        demote = (
            df[df["label"] == "anomaly"]
            .sort_values(by="risk_score", ascending=True)  # type: ignore[call-arg]
            .head(extra)
            .index
        )
        df.loc[demote, "label"] = "suspicious"

    suspicious_count = int((df["label"] == "suspicious").sum())
    if suspicious_count < min_suspicious:
        needed = min_suspicious - suspicious_count
        promote = (
            df[df["label"] == "normal"]
            .sort_values(by="risk_score", ascending=False)  # type: ignore[call-arg]
            .head(needed)
            .index
        )
        df.loc[promote, "label"] = "suspicious"
    elif suspicious_count > max_suspicious:
        extra = suspicious_count - max_suspicious
        demote = (
            df[df["label"] == "suspicious"]
            .sort_values(by="risk_score", ascending=True)  # type: ignore[call-arg]
            .head(extra)
            .index
        )
        df.loc[demote, "label"] = "normal"


def generate_synthetic_dataset(config: SyntheticConfig) -> pd.DataFrame:
    rng = np.random.default_rng(config.seed)
    users = _build_user_pool(config, rng)
    secret = get_hash_secret()

    end_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start_time = end_time - timedelta(days=config.days)

    rows: list[dict[str, object]] = []
    for event_id in range(1, config.rows + 1):
        user = users[int(rng.integers(0, len(users)))]
        scenario = str(rng.choice(SCENARIOS, p=SCENARIO_PROBS))

        day_offset = int(rng.integers(0, config.days))
        hour = _sample_hour(str(user["shift_slot"]), scenario, rng)
        minute = int(rng.choice([0, 30]))
        event_time = start_time + timedelta(days=day_offset, hours=hour, minutes=minute)

        in_shift_flag = int(_is_in_shift(str(user["shift_slot"]), event_time.hour))
        behavior = _sample_behavior(str(user["role"]), scenario, in_shift_flag, rng)

        patient_id = int(rng.integers(1, 1800))
        session_ref = f"sess-{user['user_id']}-{day_offset}-{hour}-{int(rng.integers(1000, 9999))}"
        request_ref = f"req-{event_id}-{int(rng.integers(100000, 999999))}"
        ip_ref = f"10.{int(rng.integers(0, 6))}.{int(rng.integers(0, 255))}.{int(rng.integers(1, 255))}"

        row = {
            "event_id": event_id,
            "event_time": event_time.isoformat(),
            "window_minutes": 30,
            "role": str(user["role"]),
            "shift_slot": str(user["shift_slot"]),
            "in_shift_flag": in_shift_flag,
            "hashed_user_id": hash_identifier(user["user_id"], secret=secret, namespace="user"),
            "hashed_patient_id": hash_identifier(patient_id, secret=secret, namespace="patient"),
            "hashed_session_id": hash_identifier(session_ref, secret=secret, namespace="session"),
            "hashed_ip": hash_identifier(ip_ref, secret=secret, namespace="ip"),
            "hashed_request_id": hash_identifier(request_ref, secret=secret, namespace="request"),
        }
        row.update(behavior)

        rule_score = _rule_score(pd.Series(row))
        behavior_score = _behavior_score(pd.Series(row), scenario, rng)
        risk_score = _clip(0.65 * rule_score + 0.35 * behavior_score + rng.normal(0.0, 4.5), 0.0, 100.0)

        row["rule_score"] = round(rule_score, 4)
        row["risk_score"] = round(risk_score, 4)
        row["label"] = _label_from_risk(risk_score)
        row["scenario"] = scenario
        rows.append(row)

    frame = pd.DataFrame(rows)
    _inject_label_noise(frame, rng=rng, rate=0.03)
    _rebalance_label_ranges(frame)

    frame["event_time"] = pd.to_datetime(frame["event_time"], utc=True)
    frame = frame.sort_values("event_time").reset_index(drop=True)
    frame["event_time"] = frame["event_time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    frame["label_id"] = frame["label"].map({"normal": 0, "suspicious": 1, "anomaly": 2}).astype(int)

    config.output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(config.output_path, index=False)
    return frame


def _build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate realistic synthetic activity dataset for insider-threat ML.")
    parser.add_argument("--rows", type=int, default=12000, help="Number of rows to generate.")
    parser.add_argument("--days", type=int, default=30, help="Number of simulated days.")
    parser.add_argument("--users", type=int, default=180, help="Number of synthetic users.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument(
        "--out",
        type=Path,
        default=BASE_DIR / "data" / "synthetic_activity.csv",
        help="Output CSV path.",
    )
    return parser.parse_args()


def main() -> None:
    args = _build_args()
    config = SyntheticConfig(
        rows=max(10000, args.rows),
        days=max(7, args.days),
        users=max(32, args.users),
        seed=args.seed,
        output_path=args.out,
    )
    frame = generate_synthetic_dataset(config)

    label_dist = frame["label"].value_counts(normalize=True).sort_index().to_dict()
    print(f"Generated rows: {len(frame)}")
    print(f"Saved dataset: {config.output_path}")
    print(f"Label distribution: {label_dist}")


if __name__ == "__main__":
    main()
