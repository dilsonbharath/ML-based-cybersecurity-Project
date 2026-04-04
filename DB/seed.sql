-- SQLite seed (optional)
-- Backend auto-seeds data on startup, so running this is not required.
-- If you run manually, use sqlite3 CLI against same DB file.

INSERT INTO users (full_name, email, password_hash, role) VALUES
  ('Dr. Anitha Raman', 'dr.anitha@bloom.health', '<sha256 of Doctor@123>', 'Doctor'),
  ('Nurse Priya Menon', 'nurse.priya@bloom.health', '<sha256 of Nurse@123>', 'Nurse'),
  ('Admin Ravi Kumar', 'admin.ravi@bloom.health', '<sha256 of Admin@123>', 'Administrator');
