## Kranium HMIS Backend (FastAPI + Raw SQL)

This backend uses:

- `FastAPI`
- raw SQL queries (no ORM)
- `DATABASE_URL` for Postgres (recommended for Vercel/Neon)
- fallback local SQLite file (`Backend/kranium_hmis.db`) when no Postgres URL is set

### Run (Vercel Postgres / Neon)

```powershell
cd "c:\Documents\4th year Project\Backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
$env:CORS_ORIGINS="https://your-frontend.vercel.app"
uvicorn app.main:app --reload
```

Notes:

- You can also use Vercel-provided `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `POSTGRES_URL_NON_POOLING`; backend auto-detects them.
- On startup, tables are created automatically and default seed data is inserted only when DB is empty.
- `Backend/.env.local` is auto-loaded, so you can store `DATABASE_URL` there for localhost development.
- See `Backend/.env.example` for environment variable format.

### Pre-deploy checklist (one command)

From workspace root, run:

```powershell
Set-Location "c:\Documents\4th year Project"
.\predeploy.ps1
```

This validates backend import/DB target/tables, builds frontend, and warns if required env variables are missing.

### Run (local SQLite fallback)

```powershell
cd "c:\Documents\4th year Project\Backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
uvicorn app.main:app --reload
```

API base URL:

- `http://127.0.0.1:8000/api`

Health check:

- `http://127.0.0.1:8000/health`

### Notes

- DB schema and default seed data are created automatically on startup (`init_db()`).
- Every create/update action is stored in `operation_logs`.
