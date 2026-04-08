from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

try:
    import joblib
    import numpy as np
    import pandas as pd
    from catboost import CatBoostClassifier  # type: ignore[import-not-found]
    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_recall_fscore_support,
    )
except Exception as exc:  # pragma: no cover - handled at runtime
    raise RuntimeError(
        "Missing ML dependencies. Install packages from ML/requirements.txt before running this script."
    ) from exc

from features import (
    CATEGORICAL_FEATURE_COLUMNS,
    FEATURE_COLUMNS,
    ID_TO_LABEL,
    LABEL_TO_ID,
    build_feature_frame,
    compute_rule_score,
    to_iforest_frame,
)

BASE_DIR = Path(__file__).resolve().parent
SCORE_WEIGHTS = {
    "rules": 0.50,
    "catboost": 0.35,
    "isolation_forest": 0.15,
}


@dataclass
class CandidateResult:
    objective: float
    suspicious_threshold: float
    anomaly_threshold: float
    suspicious_recall: float
    anomaly_precision: float
    macro_f1: float
    anomaly_pr_auc: float
    catboost_params: dict[str, Any]
    iforest_params: dict[str, Any]


def _time_split(frame: pd.DataFrame, test_fraction: float = 0.30) -> tuple[pd.DataFrame, pd.DataFrame, pd.Timestamp]:
    sorted_frame = frame.sort_values("event_time").reset_index(drop=True)
    split_index = int(len(sorted_frame) * (1.0 - test_fraction))
    split_index = max(1, min(split_index, len(sorted_frame) - 1))
    split_value = sorted_frame.iloc[split_index]["event_time"]
    split_timestamp = pd.to_datetime(split_value, utc=True)

    train_mask = sorted_frame["event_time"] <= split_timestamp
    train_frame = cast(pd.DataFrame, sorted_frame.loc[train_mask, :].copy())
    test_frame = cast(pd.DataFrame, sorted_frame.loc[~train_mask, :].copy())

    if test_frame.empty:
        test_frame = sorted_frame.tail(max(1, int(0.2 * len(sorted_frame)))).copy()
        train_frame = sorted_frame.iloc[: len(sorted_frame) - len(test_frame)].copy()

    return train_frame, test_frame, cast(pd.Timestamp, split_timestamp)


def _class_weights(y: pd.Series) -> list[float]:
    counts = y.value_counts().to_dict()
    classes = sorted(ID_TO_LABEL.keys())
    total = max(1, len(y))
    weights: list[float] = []
    for cls in classes:
        cls_count = max(1, int(counts.get(cls, 1)))
        weights.append(total / (len(classes) * cls_count))
    return weights


def _normalize(values: np.ndarray, min_value: float, max_value: float) -> np.ndarray:
    span = max(max_value - min_value, 1e-9)
    return np.clip((values - min_value) / span, 0.0, 1.0)


def _predict_with_thresholds(scores_100: np.ndarray, suspicious_threshold: float, anomaly_threshold: float) -> np.ndarray:
    return np.where(
        scores_100 >= anomaly_threshold,
        LABEL_TO_ID["anomaly"],
        np.where(scores_100 >= suspicious_threshold, LABEL_TO_ID["suspicious"], LABEL_TO_ID["normal"]),
    )


def _threshold_objective(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    precision, recall, _, _ = precision_recall_fscore_support(
        y_true,
        y_pred,
        labels=[LABEL_TO_ID["normal"], LABEL_TO_ID["suspicious"], LABEL_TO_ID["anomaly"]],
        zero_division=0,
    )
    precision_arr = np.asarray(precision, dtype=float)
    recall_arr = np.asarray(recall, dtype=float)
    suspicious_recall = float(recall_arr[1])
    anomaly_precision = float(precision_arr[2])
    macro_f1 = float(f1_score(y_true, y_pred, average="macro"))

    # Prioritize catching suspicious cases while preserving global quality.
    objective = (0.60 * suspicious_recall) + (0.25 * macro_f1) + (0.15 * anomaly_precision)
    return {
        "objective": objective,
        "suspicious_recall": suspicious_recall,
        "anomaly_precision": anomaly_precision,
        "macro_f1": macro_f1,
    }


def _optimize_thresholds(y_true: np.ndarray, combined_score_100: np.ndarray) -> dict[str, float]:
    best: dict[str, float] | None = None
    for suspicious_threshold in range(30, 67, 2):
        for anomaly_threshold in range(max(suspicious_threshold + 8, 58), 93, 2):
            y_pred = _predict_with_thresholds(combined_score_100, float(suspicious_threshold), float(anomaly_threshold))
            stats = _threshold_objective(y_true, y_pred)
            candidate = {
                **stats,
                "suspicious": float(suspicious_threshold),
                "anomaly": float(anomaly_threshold),
            }
            if best is None:
                best = candidate
                continue

            if candidate["objective"] > best["objective"]:
                best = candidate
                continue

            if candidate["objective"] == best["objective"]:
                if candidate["suspicious_recall"] > best["suspicious_recall"]:
                    best = candidate

    return best or {
        "objective": 0.0,
        "suspicious_recall": 0.0,
        "anomaly_precision": 0.0,
        "macro_f1": 0.0,
        "suspicious": 40.0,
        "anomaly": 70.0,
    }


def _sample_catboost_params(rng: np.random.Generator) -> dict[str, Any]:
    return {
        "depth": int(rng.integers(4, 9)),
        "learning_rate": float(rng.uniform(0.025, 0.14)),
        "iterations": int(rng.integers(280, 720)),
        "l2_leaf_reg": float(rng.uniform(1.0, 8.0)),
        "random_strength": float(rng.uniform(0.0, 2.2)),
        "border_count": int(rng.choice([128, 160, 192, 224, 254])),
    }


def _sample_iforest_params(rng: np.random.Generator) -> dict[str, Any]:
    sampled_max_samples = rng.choice(["auto", 0.60, 0.75, 0.90])
    if isinstance(sampled_max_samples, np.generic):
        sampled_max_samples = sampled_max_samples.item()
    return {
        "n_estimators": int(rng.integers(180, 520)),
        "contamination": float(rng.uniform(0.05, 0.22)),
        "max_samples": cast(Any, sampled_max_samples),
    }


def _evaluate_candidate(
    train_frame: pd.DataFrame,
    val_frame: pd.DataFrame,
    catboost_params: dict[str, Any],
    iforest_params: dict[str, Any],
    seed: int,
    cat_features: list[int],
    train_dir: Path,
) -> CandidateResult:
    x_train = train_frame[FEATURE_COLUMNS].copy()
    y_train = train_frame["label_id"].astype(int)
    x_val = val_frame[FEATURE_COLUMNS].copy()
    y_val = val_frame["label_id"].astype(int)

    for col in CATEGORICAL_FEATURE_COLUMNS:
        x_train[col] = x_train[col].astype(str)
        x_val[col] = x_val[col].astype(str)

    cat_model = CatBoostClassifier(
        loss_function="MultiClass",
        eval_metric="TotalF1",
        random_seed=seed,
        verbose=False,
        class_weights=_class_weights(y_train),
        train_dir=str(train_dir),
        **catboost_params,
    )
    cat_model.fit(x_train, y_train, cat_features=cat_features, eval_set=(x_val, y_val))

    cat_prob_val = cat_model.predict_proba(x_val)
    anomaly_class_index = int(np.where(cat_model.classes_ == LABEL_TO_ID["anomaly"])[0][0])
    cat_anomaly_prob = cat_prob_val[:, anomaly_class_index]

    x_train_iso = to_iforest_frame(train_frame)
    x_val_iso = to_iforest_frame(val_frame)
    normal_mask = y_train.to_numpy() == LABEL_TO_ID["normal"]
    fit_frame = x_train_iso[normal_mask] if int(normal_mask.sum()) >= 100 else x_train_iso

    iso_model = IsolationForest(
        random_state=seed,
        n_jobs=-1,
        **iforest_params,
    )
    iso_model.fit(fit_frame)

    iso_train_raw = -iso_model.decision_function(x_train_iso)
    iso_val_raw = -iso_model.decision_function(x_val_iso)
    iso_min = float(np.min(iso_train_raw))
    iso_max = float(np.max(iso_train_raw))
    iso_val_prob = _normalize(iso_val_raw, iso_min, iso_max)

    rule_prob = compute_rule_score(val_frame) / 100.0
    combined_prob = (
        SCORE_WEIGHTS["rules"] * rule_prob
        + SCORE_WEIGHTS["catboost"] * cat_anomaly_prob
        + SCORE_WEIGHTS["isolation_forest"] * iso_val_prob
    )
    combined_score_100 = np.clip(combined_prob * 100.0, 0.0, 100.0)
    y_true_val = y_val.to_numpy(dtype=int)

    thresholds = _optimize_thresholds(y_true_val, combined_score_100)
    y_pred_val = _predict_with_thresholds(
        combined_score_100,
        thresholds["suspicious"],
        thresholds["anomaly"],
    )

    y_true_anomaly = (y_true_val == LABEL_TO_ID["anomaly"]).astype(int)
    anomaly_pr_auc = float(average_precision_score(y_true_anomaly, combined_prob))
    objective = float(thresholds["objective"] + (0.10 * anomaly_pr_auc))

    return CandidateResult(
        objective=objective,
        suspicious_threshold=float(thresholds["suspicious"]),
        anomaly_threshold=float(thresholds["anomaly"]),
        suspicious_recall=float(thresholds["suspicious_recall"]),
        anomaly_precision=float(thresholds["anomaly_precision"]),
        macro_f1=float(thresholds["macro_f1"]),
        anomaly_pr_auc=anomaly_pr_auc,
        catboost_params=catboost_params,
        iforest_params=iforest_params,
    )


def train_models(input_path: Path, artifacts_dir: Path, seed: int = 42, tune_trials: int = 20) -> dict[str, Any]:
    raw_frame = pd.read_csv(input_path)
    frame = build_feature_frame(raw_frame)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    catboost_train_dir = artifacts_dir / "catboost_info"

    if "label_id" not in frame.columns:
        raise ValueError("Input dataset must include label and label_id columns.")

    train_frame, test_frame, split_timestamp = _time_split(frame)

    # Use a temporal validation split inside train for tuning.
    tune_train_frame, tune_val_frame, tune_split_timestamp = _time_split(train_frame, test_fraction=0.25)

    cat_feature_indices = [FEATURE_COLUMNS.index(col) for col in CATEGORICAL_FEATURE_COLUMNS]
    rng = np.random.default_rng(seed)

    default_cat_params: dict[str, Any] = {
        "depth": 6,
        "learning_rate": 0.06,
        "iterations": 450,
        "l2_leaf_reg": 3.0,
        "random_strength": 1.0,
        "border_count": 254,
    }
    default_iforest_params: dict[str, Any] = {
        "n_estimators": 320,
        "contamination": 0.10,
        "max_samples": "auto",
    }

    trials = max(1, int(tune_trials))
    trial_history: list[dict[str, Any]] = []
    best_candidate: CandidateResult | None = None

    for trial_index in range(trials):
        if trial_index == 0:
            cat_params = dict(default_cat_params)
            iso_params = dict(default_iforest_params)
        else:
            cat_params = _sample_catboost_params(rng)
            iso_params = _sample_iforest_params(rng)

        candidate = _evaluate_candidate(
            train_frame=tune_train_frame,
            val_frame=tune_val_frame,
            catboost_params=cat_params,
            iforest_params=iso_params,
            seed=seed + trial_index,
            cat_features=cat_feature_indices,
            train_dir=catboost_train_dir / f"trial_{trial_index:02d}",
        )

        trial_entry = {
            "trial": trial_index,
            "objective": float(candidate.objective),
            "suspicious_threshold": float(candidate.suspicious_threshold),
            "anomaly_threshold": float(candidate.anomaly_threshold),
            "suspicious_recall": float(candidate.suspicious_recall),
            "anomaly_precision": float(candidate.anomaly_precision),
            "macro_f1": float(candidate.macro_f1),
            "anomaly_pr_auc": float(candidate.anomaly_pr_auc),
            "catboost_params": candidate.catboost_params,
            "iforest_params": candidate.iforest_params,
        }
        trial_history.append(trial_entry)

        if best_candidate is None or candidate.objective > best_candidate.objective:
            best_candidate = candidate

    if best_candidate is None:
        raise RuntimeError("No tuning candidate produced valid metrics.")

    best_catboost_params = best_candidate.catboost_params
    best_iforest_params = best_candidate.iforest_params
    suspicious_threshold = float(best_candidate.suspicious_threshold)
    anomaly_threshold = float(best_candidate.anomaly_threshold)

    x_train = train_frame[FEATURE_COLUMNS].copy()
    x_test = test_frame[FEATURE_COLUMNS].copy()
    y_train = train_frame["label_id"].astype(int)
    y_test = test_frame["label_id"].astype(int)

    for col in CATEGORICAL_FEATURE_COLUMNS:
        x_train[col] = x_train[col].astype(str)
        x_test[col] = x_test[col].astype(str)

    cat_model = CatBoostClassifier(
        loss_function="MultiClass",
        eval_metric="TotalF1",
        random_seed=seed,
        verbose=False,
        class_weights=_class_weights(y_train),
        train_dir=str(catboost_train_dir),
        **best_catboost_params,
    )
    cat_model.fit(x_train, y_train, cat_features=cat_feature_indices, eval_set=(x_test, y_test))

    cat_pred = cat_model.predict(x_test).reshape(-1).astype(int)
    cat_prob = cat_model.predict_proba(x_test)
    anomaly_class_index = int(np.where(cat_model.classes_ == LABEL_TO_ID["anomaly"])[0][0])
    cat_anomaly_prob = cat_prob[:, anomaly_class_index]

    x_train_iso = to_iforest_frame(train_frame)
    x_test_iso = to_iforest_frame(test_frame)

    normal_mask = y_train.to_numpy() == LABEL_TO_ID["normal"]
    fit_frame = x_train_iso[normal_mask] if int(normal_mask.sum()) >= 100 else x_train_iso

    iso_model = IsolationForest(
        random_state=seed,
        n_jobs=-1,
        **best_iforest_params,
    )
    iso_model.fit(fit_frame)

    iso_train_raw = -iso_model.decision_function(x_train_iso)
    iso_test_raw = -iso_model.decision_function(x_test_iso)
    iso_min = float(np.min(iso_train_raw))
    iso_max = float(np.max(iso_train_raw))
    iso_test_prob = _normalize(iso_test_raw, iso_min, iso_max)

    rule_score = compute_rule_score(test_frame) / 100.0
    combined_score = (
        SCORE_WEIGHTS["rules"] * rule_score
        + SCORE_WEIGHTS["catboost"] * cat_anomaly_prob
        + SCORE_WEIGHTS["isolation_forest"] * iso_test_prob
    )
    risk_score = np.clip(combined_score * 100.0, 0.0, 100.0)

    ensemble_pred = _predict_with_thresholds(risk_score, suspicious_threshold, anomaly_threshold)

    y_true = y_test.to_numpy(dtype=int)
    y_true_anomaly = (y_true == LABEL_TO_ID["anomaly"]).astype(int)

    precision, recall, _, _ = precision_recall_fscore_support(
        y_true,
        ensemble_pred,
        labels=[LABEL_TO_ID["normal"], LABEL_TO_ID["suspicious"], LABEL_TO_ID["anomaly"]],
        zero_division=0,
    )
    precision_arr = np.asarray(precision, dtype=float)
    recall_arr = np.asarray(recall, dtype=float)

    metrics = {
        "catboost_accuracy": float(accuracy_score(y_true, cat_pred)),
        "ensemble_accuracy": float(accuracy_score(y_true, ensemble_pred)),
        "ensemble_f1_macro": float(f1_score(y_true, ensemble_pred, average="macro")),
        "ensemble_suspicious_recall": float(recall_arr[1]),
        "ensemble_suspicious_precision": float(precision_arr[1]),
        "ensemble_anomaly_recall": float(recall_arr[2]),
        "ensemble_anomaly_precision": float(precision_arr[2]),
        "ensemble_anomaly_pr_auc": float(average_precision_score(y_true_anomaly, combined_score)),
        "catboost_anomaly_pr_auc": float(average_precision_score(y_true_anomaly, cat_anomaly_prob)),
        "ensemble_confusion_matrix": confusion_matrix(y_true, ensemble_pred, labels=[0, 1, 2]).tolist(),
        "ensemble_classification_report": classification_report(
            y_true,
            ensemble_pred,
            labels=[0, 1, 2],
            target_names=[ID_TO_LABEL[0], ID_TO_LABEL[1], ID_TO_LABEL[2]],
            output_dict=True,
            zero_division=0,
        ),
    }

    cat_model_path = artifacts_dir / "catboost_model.cbm"
    iso_model_path = artifacts_dir / "isolation_forest.joblib"
    meta_path = artifacts_dir / "model_meta.json"
    predictions_path = artifacts_dir / "test_predictions.csv"

    cat_model.save_model(str(cat_model_path))
    joblib.dump(iso_model, iso_model_path)

    predictions = test_frame[["event_time", "role", "shift_slot", "hashed_user_id"]].copy()
    predictions["true_label"] = y_true
    predictions["catboost_pred"] = cat_pred
    predictions["ensemble_pred"] = ensemble_pred
    predictions["rule_score"] = rule_score * 100.0
    predictions["catboost_anomaly_prob"] = cat_anomaly_prob
    predictions["iforest_anomaly_prob"] = iso_test_prob
    predictions["risk_score"] = risk_score
    predictions.to_csv(predictions_path, index=False)

    meta = {
        "feature_columns": FEATURE_COLUMNS,
        "categorical_columns": CATEGORICAL_FEATURE_COLUMNS,
        "label_to_id": LABEL_TO_ID,
        "id_to_label": ID_TO_LABEL,
        "score_weights": SCORE_WEIGHTS,
        "risk_thresholds": {
            "suspicious": suspicious_threshold,
            "anomaly": anomaly_threshold,
        },
        "tuning": {
            "objective": "suspicious_recall_priority",
            "trials_requested": int(tune_trials),
            "trials_run": len(trial_history),
            "best_params": {
                "catboost": best_catboost_params,
                "isolation_forest": best_iforest_params,
            },
            "best_validation": {
                "objective": float(best_candidate.objective),
                "suspicious_recall": float(best_candidate.suspicious_recall),
                "anomaly_precision": float(best_candidate.anomaly_precision),
                "macro_f1": float(best_candidate.macro_f1),
                "anomaly_pr_auc": float(best_candidate.anomaly_pr_auc),
                "suspicious_threshold": suspicious_threshold,
                "anomaly_threshold": anomaly_threshold,
            },
            "tuning_split_timestamp_utc": tune_split_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "top_trials": sorted(trial_history, key=lambda item: item["objective"], reverse=True)[:5],
        },
        "iforest_scale": {
            "min": iso_min,
            "max": iso_max,
        },
        "split_timestamp_utc": split_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "metrics": metrics,
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def _build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train CatBoost and Isolation Forest on synthetic insider-threat data.")
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
        help="Output artifacts directory.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--tune-trials",
        type=int,
        default=20,
        help="Random-search tuning trials (minimum 1).",
    )
    return parser.parse_args()


def main() -> None:
    args = _build_args()
    meta = train_models(
        input_path=args.input,
        artifacts_dir=args.artifacts_dir,
        seed=args.seed,
        tune_trials=args.tune_trials,
    )
    metrics = cast(dict[str, float], meta.get("metrics", {}))
    print(f"Model artifacts saved in: {args.artifacts_dir}")
    print(f"Ensemble accuracy: {float(metrics.get('ensemble_accuracy', 0.0)):.4f}")
    print(f"Ensemble anomaly PR-AUC: {float(metrics.get('ensemble_anomaly_pr_auc', 0.0)):.4f}")
    thresholds = cast(dict[str, float], meta.get("risk_thresholds", {}))
    print(
        "Optimized thresholds: "
        f"suspicious={float(thresholds.get('suspicious', 40.0)):.1f}, "
        f"anomaly={float(thresholds.get('anomaly', 70.0)):.1f}"
    )


if __name__ == "__main__":
    main()
