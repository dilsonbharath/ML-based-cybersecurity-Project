from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, cast

from score_events import score_events
from synthetic_data import SyntheticConfig, generate_synthetic_dataset
from train_models import train_models

BASE_DIR = Path(__file__).resolve().parent


def _build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full synthetic-data -> training -> scoring ML workflow.")
    parser.add_argument("--rows", type=int, default=12000, help="Rows to generate (minimum enforced: 10000).")
    parser.add_argument("--days", type=int, default=30, help="Days to simulate.")
    parser.add_argument("--users", type=int, default=180, help="Synthetic users to simulate.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--tune-trials",
        type=int,
        default=20,
        help="Hyperparameter tuning trials for model selection.",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=BASE_DIR / "data" / "synthetic_activity.csv",
        help="Generated dataset path.",
    )
    parser.add_argument(
        "--scored",
        type=Path,
        default=BASE_DIR / "data" / "scored_activity.csv",
        help="Scored output path.",
    )
    parser.add_argument(
        "--artifacts",
        type=Path,
        default=BASE_DIR / "artifacts",
        help="Artifact output directory.",
    )
    return parser.parse_args()


def main() -> None:
    args = _build_args()

    config = SyntheticConfig(
        rows=max(10000, args.rows),
        days=max(7, args.days),
        users=max(32, args.users),
        seed=args.seed,
        output_path=args.dataset,
    )

    dataset = generate_synthetic_dataset(config)
    meta = train_models(
        input_path=args.dataset,
        artifacts_dir=args.artifacts,
        seed=args.seed,
        tune_trials=args.tune_trials,
    )
    scored = score_events(input_path=args.dataset, artifacts_dir=args.artifacts, output_path=args.scored)

    label_dist = dataset["label"].value_counts(normalize=True).sort_index().to_dict()

    print("Pipeline complete.")
    print(f"Generated rows: {len(dataset)}")
    print(f"Label distribution: {label_dist}")
    print(f"Scored rows: {len(scored)}")
    print(f"Artifacts directory: {args.artifacts}")
    metrics = cast(dict[str, Any], meta.get("metrics", {}))
    print(f"Ensemble accuracy: {float(metrics.get('ensemble_accuracy', 0.0)):.4f}")
    print(f"Ensemble anomaly PR-AUC: {float(metrics.get('ensemble_anomaly_pr_auc', 0.0)):.4f}")
    thresholds = cast(dict[str, Any], meta.get("risk_thresholds", {}))
    print(
        "Thresholds: "
        f"suspicious={float(thresholds.get('suspicious', 40.0)):.1f}, "
        f"anomaly={float(thresholds.get('anomaly', 70.0)):.1f}"
    )


if __name__ == "__main__":
    main()
