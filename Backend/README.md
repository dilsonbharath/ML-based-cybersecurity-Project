## Kranium HMIS Backend (FastAPI + Raw SQL)

This backend uses:

- `FastAPI`
- `sqlite3` raw SQL queries (no ORM)
- local SQLite file: `Backend/kranium_hmis.db`

### Run

```powershell
cd "c:\Documents\4th year Project\Backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API base URL:

- `http://127.0.0.1:8000/api`

Health check:

- `http://127.0.0.1:8000/health`

### Notes

- DB schema and default seed data are created automatically on startup (`init_db()`).
- Every create/update action is stored in `operation_logs`.
