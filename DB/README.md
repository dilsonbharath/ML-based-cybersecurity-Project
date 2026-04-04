## HMIS DB Scripts

These SQL files are aligned with the FastAPI backend in `Backend/` and follow a raw SQL (non-ORM) structure.

- `schema.sql`: SQLite table definitions
- `seed.sql`: optional seed example

Important:

- The backend already creates tables + default data automatically on startup.
- Actual local DB file used by backend: `Backend/kranium_hmis.db`.
