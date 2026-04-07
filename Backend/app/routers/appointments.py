from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from ..cache import get_cached_json, invalidate_all_cache, make_cache_key, set_cached_json
from ..database import STATUS_SET, get_connection, log_operation, to_dict, to_list
from ..deps import require_roles
from ..schemas import AppointmentCreate, AppointmentStatusUpdate

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("")
def list_appointments(
    user=Depends(require_roles("Doctor", "Nurse", "Administrator", "registration_desk"))
):
    cache_key = make_cache_key("appointments", "all", user["role"], user["id"])
    cached = get_cached_json(cache_key)
    if cached is not None:
        return cached

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              a.id,
              a.patient_id,
              a.doctor_id,
              a.appointment_date,
              a.appointment_time,
              a.status,
              p.full_name AS patient_name,
              p.uhid AS patient_uhid
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            ORDER BY a.appointment_date DESC, a.appointment_time
            """
        ).fetchall()

    data = []
    for row in rows:
        payload = to_dict(row)
        payload["patient"] = {
            "id": payload["patient_id"],
            "fullName": payload.pop("patient_name"),
            "uhid": payload.pop("patient_uhid"),
        }
        payload["appointmentTime"] = payload.pop("appointment_time")
        payload["appointmentDate"] = payload.pop("appointment_date")
        data.append(payload)
    set_cached_json(cache_key, data, ttl_seconds=12)
    return data


@router.get("/today")
def todays_appointments(
    user=Depends(require_roles("Doctor", "Nurse", "Administrator", "registration_desk"))
):
    today = date.today().isoformat()
    cache_key = make_cache_key("appointments", "today", today, user["role"], user["id"])
    cached = get_cached_json(cache_key)
    if cached is not None:
        return cached

    with get_connection() as conn:
        if user["role"] == "Doctor":
            rows = conn.execute(
                """
                SELECT
                  a.id,
                  a.patient_id,
                  a.doctor_id,
                  a.appointment_date,
                  a.appointment_time,
                  a.status,
                  p.full_name AS patient_name,
                  p.uhid AS patient_uhid
                FROM appointments a
                JOIN patients p ON p.id = a.patient_id
                WHERE a.appointment_date = ? AND a.doctor_id = ?
                ORDER BY a.appointment_time
                """,
                (today, user["id"]),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT
                  a.id,
                  a.patient_id,
                  a.doctor_id,
                  a.appointment_date,
                  a.appointment_time,
                  a.status,
                  p.full_name AS patient_name,
                  p.uhid AS patient_uhid
                FROM appointments a
                JOIN patients p ON p.id = a.patient_id
                WHERE a.appointment_date = ?
                ORDER BY a.appointment_time
                """,
                (today,),
            ).fetchall()

    data = []
    for row in rows:
        payload = to_dict(row)
        payload["patient"] = {
            "id": payload["patient_id"],
            "fullName": payload.pop("patient_name"),
            "uhid": payload.pop("patient_uhid"),
        }
        payload["appointmentTime"] = payload.pop("appointment_time")
        payload["appointmentDate"] = payload.pop("appointment_date")
        data.append(payload)
    set_cached_json(cache_key, data, ttl_seconds=8)
    return data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    doctor_id = payload.doctor_id if payload.doctor_id is not None else user["id"]
    if user["role"] == "Doctor":
        doctor_id = user["id"]
    if payload.status not in STATUS_SET:
        raise HTTPException(status_code=400, detail="Invalid status")

    with get_connection() as conn:
        patient = conn.execute("SELECT id FROM patients WHERE id = ?", (payload.patient_id,)).fetchone()
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        doctor = conn.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'Doctor' AND is_active = 1",
            (doctor_id,),
        ).fetchone()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        cursor = conn.execute(
            """
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (payload.patient_id, doctor_id, payload.appointment_date, payload.appointment_time, payload.status),
        )
        appointment_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "appointments",
            str(appointment_id),
            "New appointment created",
        )
    invalidate_all_cache()
    return {"ok": True, "id": appointment_id}


@router.patch("/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    user=Depends(require_roles("Doctor", "Nurse")),
):
    with get_connection() as conn:
        exists = conn.execute("SELECT id FROM appointments WHERE id = ?", (appointment_id,)).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="Appointment not found")

        conn.execute(
            "UPDATE appointments SET status = ? WHERE id = ?",
            (payload.status, appointment_id),
        )
        log_operation(
            conn,
            user["id"],
            "update",
            "appointments",
            str(appointment_id),
            f"Status set to {payload.status}",
        )
    invalidate_all_cache()
    return {"ok": True}
