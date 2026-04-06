from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "Backend" / ".env.local"
KEEP_TABLES = {"users", "patients"}


def load_database_url() -> str:
    values = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
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
        raise RuntimeError("No database URL found in Backend/.env.local")
    return url


def main() -> None:
    url = load_database_url()

    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            existing = [row[0] for row in cur.fetchall()]

            to_drop = [name for name in existing if name not in KEEP_TABLES]
            for name in to_drop:
                cur.execute(f'DROP TABLE IF EXISTS public."{name}" CASCADE')

            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            remaining = [row[0] for row in cur.fetchall()]

        conn.commit()

    print(f"DROPPED_COUNT={len(to_drop)}")
    for name in to_drop:
        print(f"DROPPED={name}")

    print(f"REMAINING_COUNT={len(remaining)}")
    for name in remaining:
        print(f"REMAINING={name}")


if __name__ == "__main__":
    main()
