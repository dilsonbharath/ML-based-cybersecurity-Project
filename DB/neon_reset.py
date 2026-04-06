import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "Backend"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_database_url(cli_value: str | None) -> str:
    if cli_value:
        return cli_value

    load_env_file(BACKEND_DIR / ".env.local")
    load_env_file(BACKEND_DIR / ".env")

    for key in (
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL_NON_POOLING",
    ):
        value = os.getenv(key, "").strip()
        if value:
            return value

    raise RuntimeError("No DATABASE_URL-like value found in Backend/.env.local or Backend/.env")


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def create_backup_schema(conn: psycopg.Connection, backup_schema: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {quote_ident(backup_schema)}")
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        tables = [row[0] for row in cur.fetchall()]

        for table in tables:
            cur.execute(
                f"DROP TABLE IF EXISTS {quote_ident(backup_schema)}.{quote_ident(table)} CASCADE"
            )
            cur.execute(
                f"CREATE TABLE {quote_ident(backup_schema)}.{quote_ident(table)} AS "
                f"TABLE public.{quote_ident(table)}"
            )

    return len(tables)


def reset_public_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE")
        cur.execute("CREATE SCHEMA public")
        cur.execute("SELECT current_user")
        current_user = cur.fetchone()[0]
        cur.execute(f"GRANT ALL ON SCHEMA public TO {quote_ident(current_user)}")
        cur.execute("GRANT ALL ON SCHEMA public TO public")


def count_public_tables(conn: psycopg.Connection) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Backup and reset Neon/Postgres public schema")
    parser.add_argument("--database-url", default=None, help="Optional explicit DB URL")
    parser.add_argument(
        "--backup-schema",
        default=f"public_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        help="Backup schema name",
    )
    parser.add_argument(
        "--skip-reset",
        action="store_true",
        help="Create backup schema only, do not drop/recreate public",
    )
    args = parser.parse_args()

    database_url = get_database_url(args.database_url)
    with psycopg.connect(database_url, autocommit=False) as conn:
        copied = create_backup_schema(conn, args.backup_schema)
        if not args.skip_reset:
            reset_public_schema(conn)
        conn.commit()

        public_count = count_public_tables(conn)

    print(f"BACKUP_SCHEMA={args.backup_schema}")
    print(f"COPIED_TABLES={copied}")
    print(f"PUBLIC_TABLE_COUNT={public_count}")


if __name__ == "__main__":
    main()
