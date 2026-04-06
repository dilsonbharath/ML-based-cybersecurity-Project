from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import IntegrityError, get_connection, log_operation, to_dict, to_list
from ..deps import require_roles
from ..schemas import PatientCreate, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])


def _fetch_patient(conn, patient_id: int):
    return conn.execute(
        """
        SELECT
          p.id,
          p.uhid,
          p.full_name,
          p.age,
          p.gender,
          p.assigned_doctor_id,
          d.full_name AS assigned_doctor_name
        FROM patients p
        JOIN users d ON d.id = p.assigned_doctor_id
        WHERE p.id = ?
        """,
        (patient_id,),
    ).fetchone()


@router.get("")
def list_patients(
    search: str | None = Query(default=None),
    user=Depends(require_roles("Doctor", "Nurse", "Administrator", "registration_desk")),
):
    with get_connection() as conn:
        if search:
            query = f"%{search.strip().lower()}%"
            rows = conn.execute(
                """
                SELECT
                  p.id,
                  p.uhid,
                  p.full_name,
                  p.age,
                  p.gender,
                  p.assigned_doctor_id,
                  d.full_name AS assigned_doctor_name
                FROM patients p
                JOIN users d ON d.id = p.assigned_doctor_id
                WHERE LOWER(p.full_name) LIKE ? OR LOWER(p.uhid) LIKE ?
                ORDER BY p.full_name
                """,
                (query, query),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT
                  p.id,
                  p.uhid,
                  p.full_name,
                  p.age,
                  p.gender,
                  p.assigned_doctor_id,
                  d.full_name AS assigned_doctor_name
                FROM patients p
                JOIN users d ON d.id = p.assigned_doctor_id
                ORDER BY p.full_name
                """
            ).fetchall()
    return to_list(rows)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    assigned_doctor_id = payload.assigned_doctor_id
    if user["role"] == "Doctor" and assigned_doctor_id is None:
        assigned_doctor_id = user["id"]
    if assigned_doctor_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="assigned_doctor_id is required for nurse-created patients",
        )

    with get_connection() as conn:
        doctor = conn.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'Doctor' AND is_active = 1",
            (assigned_doctor_id,),
        ).fetchone()
        if doctor is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Doctor not found")

        try:
            cursor = conn.execute(
                """
                INSERT INTO patients (uhid, full_name, age, gender, assigned_doctor_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    payload.uhid.strip(),
                    payload.full_name.strip(),
                    payload.age,
                    payload.gender,
                    assigned_doctor_id,
                ),
            )
        except IntegrityError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="UHID already exists") from exc

        patient_id = int(cursor.lastrowid)
        conn.execute("INSERT INTO clinical_history (patient_id) VALUES (?)", (patient_id,))
        conn.execute("INSERT INTO billing_status (patient_id) VALUES (?)", (patient_id,))
        log_operation(
            conn,
            user["id"],
            "create",
            "patients",
            str(patient_id),
            f"Added patient {payload.full_name.strip()}",
        )

        row = _fetch_patient(conn, patient_id)
    return to_dict(row)


@router.put("/{patient_id}")
def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    updates: list[str] = []
    values: list[object] = []

    if payload.uhid is not None:
        updates.append("uhid = ?")
        values.append(payload.uhid.strip())
    if payload.full_name is not None:
        updates.append("full_name = ?")
        values.append(payload.full_name.strip())
    if payload.age is not None:
        updates.append("age = ?")
        values.append(payload.age)
    if payload.gender is not None:
        updates.append("gender = ?")
        values.append(payload.gender)
    if payload.assigned_doctor_id is not None:
        updates.append("assigned_doctor_id = ?")
        values.append(payload.assigned_doctor_id)

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(patient_id)

    with get_connection() as conn:
        exists = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

        if payload.assigned_doctor_id is not None:
            doctor_exists = conn.execute(
                "SELECT id FROM users WHERE id = ? AND role = 'Doctor' AND is_active = 1",
                (payload.assigned_doctor_id,),
            ).fetchone()
            if doctor_exists is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned doctor not found",
                )

        try:
            conn.execute(
                f"UPDATE patients SET {', '.join(updates)} WHERE id = ?",
                tuple(values),
            )
        except IntegrityError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="UHID already exists") from exc

        log_operation(
            conn,
            user["id"],
            "update",
            "patients",
            str(patient_id),
            "Updated patient demographics",
        )

        row = _fetch_patient(conn, patient_id)
    return to_dict(row)
