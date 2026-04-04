import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Any, Iterable

from .security import hash_password

BASE_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BASE_DIR / "kranium_hmis.db"

STATUS_SET = {"Scheduled", "Checked In", "In Consultation", "Completed"}

SCHEMA_SQL = """
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
"""


def to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def to_list(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [{key: row[key] for key in row.keys()} for row in rows]


@contextmanager
def get_connection():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def log_operation(
    conn: sqlite3.Connection,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str = "",
) -> None:
    conn.execute(
        """
        INSERT INTO operation_logs (user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, action, entity_type, entity_id, details),
    )


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA_SQL)

        user_count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        if user_count > 0:
            return

        users = [
            ("Dr. Anitha Raman", "dr.anitha@bloom.health", "Doctor@123", "Doctor"),
            ("Nurse Priya Menon", "nurse.priya@bloom.health", "Nurse@123", "Nurse"),
            ("Admin Ravi Kumar", "admin.ravi@bloom.health", "Admin@123", "Administrator"),
        ]
        for full_name, email, password, role in users:
            conn.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES (?, ?, ?, ?)
                """,
                (full_name, email.lower(), hash_password(password), role),
            )

        doctor_id = conn.execute(
            "SELECT id FROM users WHERE role = 'Doctor' ORDER BY id LIMIT 1"
        ).fetchone()["id"]

        patients = [
            ("UHID-2026-1001", "Arun K", 46, "Male", doctor_id),
            ("UHID-2026-1002", "Meera V", 31, "Female", doctor_id),
            ("UHID-2026-1003", "Sanjay T", 58, "Male", doctor_id),
            ("UHID-2026-1004", "Lakshmi R", 40, "Female", doctor_id),
        ]

        patient_ids: list[int] = []
        for uhid, name, age, gender, assigned_doctor_id in patients:
            cursor = conn.execute(
                """
                INSERT INTO patients (uhid, full_name, age, gender, assigned_doctor_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (uhid, name, age, gender, assigned_doctor_id),
            )
            patient_id = int(cursor.lastrowid)
            patient_ids.append(patient_id)
            conn.execute("INSERT INTO clinical_history (patient_id) VALUES (?)", (patient_id,))
            conn.execute("INSERT INTO billing_status (patient_id) VALUES (?)", (patient_id,))

        today = date.today().isoformat()
        appointments = [
            (patient_ids[0], doctor_id, today, "09:00", "Checked In"),
            (patient_ids[1], doctor_id, today, "10:30", "Scheduled"),
            (patient_ids[2], doctor_id, today, "12:15", "Scheduled"),
            (patient_ids[3], doctor_id, today, "15:20", "In Consultation"),
        ]
        for row in appointments:
            conn.execute(
                """
                INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status)
                VALUES (?, ?, ?, ?, ?)
                """,
                row,
            )

        conn.execute(
            """
            UPDATE clinical_history
            SET chief_complaint = ?, past_medical_history = ?, social_family_history = ?
            WHERE patient_id = ?
            """,
            (
                "Fever with dry cough for three days.",
                "Type 2 diabetes (8 years)\nNo known drug allergy",
                "Father has hypertension\nNon-smoker, no alcohol",
                patient_ids[0],
            ),
        )
        conn.execute(
            """
            INSERT INTO vitals (
              patient_id, recorded_at, blood_pressure, heart_rate, temperature, spo2, respiratory_rate, physical_findings
            ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_ids[0],
                "138/88",
                "96 bpm",
                "100.4 F",
                "97%",
                "20/min",
                "Mild throat congestion",
            ),
        )
        conn.execute(
            """
            INSERT INTO charges (patient_id, item, amount, captured_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (patient_ids[0], "Consultation Fee", 800),
        )
