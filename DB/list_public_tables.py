from pathlib import Path

import psycopg

values = {}
for line in Path("Backend/.env.local").read_text(encoding="utf-8").splitlines():
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

conn = psycopg.connect(url)
cur = conn.cursor()
cur.execute(
    """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
    """
)
print("TABLES=")
for row in cur.fetchall():
    print(row[0])
conn.close()
