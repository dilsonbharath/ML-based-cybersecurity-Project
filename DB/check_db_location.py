from pathlib import Path
from urllib.parse import urlparse

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
    or ""
)

if not url:
    print("NO_DATABASE_URL")
    raise SystemExit(0)

host = urlparse(url).hostname or ""
print(f"DB_HOST={host}")
print(f"IS_LOCAL={'yes' if host in ('localhost', '127.0.0.1') else 'no'}")
