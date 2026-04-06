-- WARNING: This script is destructive.
-- It drops and recreates the entire public schema in Postgres/Neon.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

COMMIT;
