# Insider Threat ML Pipeline

This folder contains a standalone ML workflow for your healthcare cybersecurity use case.

## What It Does

1. Generates realistic synthetic behavior data (default: 12,000 rows over 30 days).
2. Applies privacy-preserving hashing (HMAC-SHA256) to identity/network fields.
3. Builds model-ready features from event windows.
4. Trains:
   - CatBoost (primary multiclass model: normal, suspicious, anomaly)
   - Isolation Forest (secondary unsupervised detector)
5. Produces a combined risk score with rule + ML ensemble weighting.
6. Exports model artifacts and scored outputs for admin review.

## Data Privacy

The generator stores hashed identifiers only:
- `hashed_user_id`
- `hashed_patient_id`
- `hashed_session_id`
- `hashed_ip`
- `hashed_request_id`

## Setup

```powershell
cd "c:\Documents\4th year Project\ML"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
# update .env with your own ML_HASH_SECRET
```

## Run End-to-End

```powershell
cd "c:\Documents\4th year Project\ML"
python run_pipeline.py --rows 12000 --seed 42 --tune-trials 20
```

## Run Step by Step

```powershell
python synthetic_data.py --rows 12000 --out data/synthetic_activity.csv --seed 42
python train_models.py --input data/synthetic_activity.csv --artifacts-dir artifacts --seed 42 --tune-trials 20
python score_events.py --input data/synthetic_activity.csv --artifacts-dir artifacts --output data/scored_activity.csv
```

## Serve ML On Separate Server

Run this service independently from backend:

```powershell
cd "c:\Documents\4th year Project\ML"
uvicorn api_server:app --host 0.0.0.0 --port 8100
```

Optional environment variables:

- `ML_ARTIFACTS_DIR` (default: `ML/artifacts`)
- `ML_HASH_SECRET` (must match your secure deployment secret)

## Output Files

- `data/synthetic_activity.csv`
- `data/scored_activity.csv`
- `artifacts/catboost_model.cbm`
- `artifacts/isolation_forest.joblib`
- `artifacts/model_meta.json`
- `artifacts/test_predictions.csv`

## Ensemble Risk Formula

The risk score uses your agreed weighting model:

- hard policy rules
- nurse-scope feature at 50% strength
- registration-desk clinical-read feature at 50% strength
- CatBoost probability
- Isolation Forest anomaly signal

Implemented formula:

$$Risk = 0.50 * Rules + 0.35 * CatBoost + 0.15 * IsolationForest$$

## Notes

- Training now includes random-search hyperparameter tuning and threshold optimization focused on suspicious recall.
- Backend integration can call this ML API remotely via `ML_SERVICE_URL`.
- Retention target for production logs remains 30 days (as discussed).
