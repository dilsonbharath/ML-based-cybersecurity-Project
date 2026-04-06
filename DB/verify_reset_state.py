import os
from pathlib import Path

import psycopg


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_database_url() -> str:
    backend = Path(__file__).resolve().parent.parent / "Backend"
    load_env_file(backend / ".env.local")
    load_env_file(backend / ".env")

    for key in (
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL_NON_POOLING",
    ):
        value = os.getenv(key, "").strip()
        if value:
            return value
    raise RuntimeError("No database URL found")


def main() -> None:
    conn = psycopg.connect(get_database_url())
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name LIKE 'public_backup_%'
            ORDER BY schema_name DESC
            LIMIT 1
            """
        )
        backup_schema_row = cur.fetchone()
        backup_schema = backup_schema_row[0] if backup_schema_row else "NONE"

        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """
        )
        public_tables = int(cur.fetchone()[0])

        backup_tables = 0
        if backup_schema != "NONE":
            cur.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = %s AND table_type = 'BASE TABLE'
                """,
                (backup_schema,),
            )
            backup_tables = int(cur.fetchone()[0])

    conn.close()

    print(f"LATEST_BACKUP_SCHEMA={backup_schema}")
    print(f"PUBLIC_TABLES={public_tables}")
    print(f"BACKUP_TABLES={backup_tables}")


if __name__ == "__main__":
    main()
