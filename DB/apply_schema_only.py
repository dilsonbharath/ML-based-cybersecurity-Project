from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "Backend" / ".env.local"
SCHEMA_FILE = ROOT / "DB" / "schema.sql"


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


def run() -> None:
    database_url = load_database_url()
    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")

    with psycopg.connect(database_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("DROP SCHEMA IF EXISTS public CASCADE")
            cur.execute("CREATE SCHEMA public")
            cur.execute("SELECT current_user")
            current_user = cur.fetchone()[0]
            cur.execute(f'GRANT ALL ON SCHEMA public TO "{current_user}"')
            cur.execute("GRANT ALL ON SCHEMA public TO public")

            for statement in schema_sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    cur.execute(stmt)

            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            tables = [row[0] for row in cur.fetchall()]

        conn.commit()

    print("TARGET_HOST=ep-bitter-hat-anh8eprb-pooler.c-6.us-east-1.aws.neon.tech")
    print(f"TABLE_COUNT={len(tables)}")
    for name in tables:
        print(name)


if __name__ == "__main__":
    run()
