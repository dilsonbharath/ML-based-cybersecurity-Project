# Neon DB Reset Runbook

This runbook resets the `public` schema and lets your backend recreate tables via `init_db()`.

## 1) Confirm exact Neon target
- Confirm Neon project name.
- Confirm database name.
- Confirm branch name.
- Confirm the exact connection string you will use for reset.

## 2) Take backup or branch snapshot
Pick one:
- Create a Neon branch snapshot from current branch (recommended).
- Export logical backup:
  - `pg_dump "$env:DATABASE_URL" --schema=public --format=custom --file neon-public-backup.dump`

## 3) Drop and recreate `public` schema
Run SQL in [DB/reset_public_schema.sql](reset_public_schema.sql).

## 4) Recreate tables from code
- Start backend once with Neon `DATABASE_URL`.
- Backend `init_db()` runs in app lifespan and recreates tables.

## 5) Verify schema
Run SQL in [DB/verify_schema.sql](verify_schema.sql).
Expected core tables include:
- `appointments`
- `billing_status`
- `charges`
- `clinical_history`
- `imaging_orders`
- `imaging_reports`
- `lab_orders`
- `lab_results`
- `operation_logs`
- `patients`
- `sessions`
- `users`
- `vitals`

## 6) Verify API endpoints
Run Playwright backend API suite:
- `cd Frontend`
- `$env:BACKEND_BASE_URL="http://127.0.0.1:8000"`
- `npm run test:e2e:backend`

Run frontend suite separately:
- `npm run test:e2e:frontend`

## Notes
- The reset script is destructive and irreversible without backup/snapshot.
- Backend and frontend server start are intentionally manual per your request.
