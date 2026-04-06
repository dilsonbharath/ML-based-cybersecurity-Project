-- Run after backend init_db() to verify table recreation.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public';
