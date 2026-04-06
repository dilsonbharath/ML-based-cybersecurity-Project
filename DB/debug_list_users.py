import os
from pathlib import Path

import psycopg

backend_env = Path(__file__).resolve().parent.parent / "Backend" / ".env.local"
values = {}
for line in backend_env.read_text(encoding="utf-8").splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    values[k.strip()] = v.strip().strip('"').strip("'")

url = (
    values.get("DATABASE_URL")
    or values.get("POSTGRES_URL")
    or values.get("POSTGRES_PRISMA_URL")
    or values.get("POSTGRES_URL_NON_POOLING")
)

if not url:
    raise RuntimeError("No DB URL found in Backend/.env.local")

conn = psycopg.connect(url)
cur = conn.cursor()
cur.execute("SELECT email, role, is_active FROM users ORDER BY id")
rows = cur.fetchall()
print(f"USER_COUNT={len(rows)}")
for email, role, active in rows:
    print(f"{email} | {role} | active={active}")

conn.close()
