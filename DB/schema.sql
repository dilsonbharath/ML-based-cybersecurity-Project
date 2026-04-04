-- SQLite schema for Kranium HMIS (matches Backend/app/database.py)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Doctor', 'Nurse', 'Administrator')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uhid TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0),
  gender TEXT NOT NULL,
  assigned_doctor_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Scheduled', 'Checked In', 'In Consultation', 'Completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS clinical_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL UNIQUE,
  chief_complaint TEXT NOT NULL DEFAULT '',
  past_medical_history TEXT NOT NULL DEFAULT '',
  social_family_history TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  blood_pressure TEXT NOT NULL,
  heart_rate TEXT NOT NULL,
  temperature TEXT NOT NULL,
  spo2 TEXT NOT NULL,
  respiratory_rate TEXT NOT NULL,
  physical_findings TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  test_name TEXT NOT NULL,
  ordered_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Completed')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_order_id INTEGER NOT NULL,
  result_value TEXT NOT NULL,
  result_flag TEXT NOT NULL CHECK (result_flag IN ('Normal', 'Abnormal')),
  reported_at TEXT NOT NULL,
  FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS imaging_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  imaging_type TEXT NOT NULL,
  ordered_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Reported')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS imaging_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imaging_order_id INTEGER NOT NULL,
  report_text TEXT NOT NULL,
  reported_at TEXT NOT NULL,
  FOREIGN KEY (imaging_order_id) REFERENCES imaging_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL UNIQUE,
  billing_status TEXT NOT NULL DEFAULT 'Deposit Sufficient',
  insurance_approval TEXT NOT NULL DEFAULT 'Not Required',
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  amount REAL NOT NULL,
  captured_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
