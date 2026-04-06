-- Optional logical snapshot helper for Neon/Postgres.
-- Run this only if you are exporting manually with psql/pg_dump.
-- Example (PowerShell):
-- pg_dump "$env:DATABASE_URL" --schema=public --format=custom --file neon-public-backup.dump

SELECT current_database() AS database_name;
SELECT current_schema() AS active_schema;
