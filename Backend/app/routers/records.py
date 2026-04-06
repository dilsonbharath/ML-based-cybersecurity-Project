from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_connection, log_operation, to_dict, to_list
from ..deps import require_roles
from ..schemas import (
    ChargeCreate,
    ClinicalRecordUpdate,
    ImagingOrderCreate,
    ImagingReportCreate,
    LabOrderCreate,
    LabResultCreate,
    VitalsCreate,
)

router = APIRouter(prefix="/patients", tags=["records"])


def _split_lines(text: str | None) -> list[str]:
    if not text:
        return []
    return [line.strip() for line in text.splitlines() if line.strip()]


def _patient_exists(conn, patient_id: int) -> bool:
    row = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
    return row is not None


@router.get("/{patient_id}/record")
def get_patient_record(
    patient_id: int,
    user=Depends(require_roles("Doctor", "Nurse", "Administrator", "registration_desk")),
):
    with get_connection() as conn:
        patient = conn.execute(
            """
            SELECT
              p.id,
              p.full_name,
              p.age,
              p.gender,
              p.uhid,
              d.full_name AS doctor_assigned
            FROM patients p
            JOIN users d ON d.id = p.assigned_doctor_id
            WHERE p.id = ?
            """,
            (patient_id,),
        ).fetchone()
        if patient is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

        clinical = conn.execute(
            """
            SELECT chief_complaint, past_medical_history, social_family_history
            FROM clinical_history
            WHERE patient_id = ?
            """,
            (patient_id,),
        ).fetchone()

        vitals = conn.execute(
            """
            SELECT
              recorded_at,
              blood_pressure,
              heart_rate,
              temperature,
              spo2,
              respiratory_rate,
              physical_findings
            FROM vitals
            WHERE patient_id = ?
            ORDER BY recorded_at DESC
            LIMIT 20
            """,
            (patient_id,),
        ).fetchall()

        lab_orders = conn.execute(
            """
            SELECT id, test_name, ordered_at, status
            FROM lab_orders
            WHERE patient_id = ?
            ORDER BY ordered_at DESC
            """,
            (patient_id,),
        ).fetchall()

        lab_results = conn.execute(
            """
            SELECT
              lr.lab_order_id,
              lo.test_name,
              lr.result_value,
              lr.result_flag,
              lr.reported_at
            FROM lab_results lr
            JOIN lab_orders lo ON lo.id = lr.lab_order_id
            WHERE lo.patient_id = ?
            ORDER BY lr.reported_at DESC
            """,
            (patient_id,),
        ).fetchall()

        imaging_orders = conn.execute(
            """
            SELECT id, imaging_type, ordered_at, status
            FROM imaging_orders
            WHERE patient_id = ?
            ORDER BY ordered_at DESC
            """,
            (patient_id,),
        ).fetchall()

        imaging_reports = conn.execute(
            """
            SELECT
              ir.imaging_order_id,
              io.imaging_type,
              ir.report_text,
              ir.reported_at
            FROM imaging_reports ir
            JOIN imaging_orders io ON io.id = ir.imaging_order_id
            WHERE io.patient_id = ?
            ORDER BY ir.reported_at DESC
            """,
            (patient_id,),
        ).fetchall()

        billing = conn.execute(
            "SELECT billing_status, insurance_approval FROM billing_status WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()

        charges = conn.execute(
            "SELECT item, amount, captured_at FROM charges WHERE patient_id = ? ORDER BY captured_at DESC",
            (patient_id,),
        ).fetchall()

    patient_data = to_dict(patient)
    clinical_data = to_dict(clinical) or {
        "chief_complaint": "",
        "past_medical_history": "",
        "social_family_history": "",
    }
    vitals_data = []
    physical_findings = []
    for item in vitals:
        row = to_dict(item)
        vitals_data.append(
            {
                "recordedAt": row["recorded_at"],
                "bloodPressure": row["blood_pressure"],
                "heartRate": row["heart_rate"],
                "temperature": row["temperature"],
                "spo2": row["spo2"],
                "respiratoryRate": row["respiratory_rate"],
            }
        )
        if row["physical_findings"]:
            physical_findings.append(row["physical_findings"])

    return {
        "patient": {
            "id": patient_data["id"],
            "fullName": patient_data["full_name"],
            "age": patient_data["age"],
            "gender": patient_data["gender"],
            "uhid": patient_data["uhid"],
            "doctorAssigned": patient_data["doctor_assigned"],
        },
        "record": {
            "chiefComplaint": clinical_data["chief_complaint"],
            "pastMedicalHistory": _split_lines(clinical_data["past_medical_history"]),
            "socialFamilyHistory": _split_lines(clinical_data["social_family_history"]),
            "vitals": vitals_data,
            "physicalFindings": physical_findings,
            "labOrders": [
                {
                    "id": f"LAB-{row['id']}",
                    "testName": row["test_name"],
                    "orderedAt": row["ordered_at"],
                    "status": row["status"],
                }
                for row in to_list(lab_orders)
            ],
            "labResults": [
                {
                    "labOrderId": f"LAB-{row['lab_order_id']}",
                    "testName": row["test_name"],
                    "resultValue": row["result_value"],
                    "flag": row["result_flag"],
                    "reportedAt": row["reported_at"],
                }
                for row in to_list(lab_results)
            ],
            "imagingOrders": [
                {
                    "id": f"IMG-{row['id']}",
                    "imagingType": row["imaging_type"],
                    "orderedAt": row["ordered_at"],
                    "status": row["status"],
                }
                for row in to_list(imaging_orders)
            ],
            "imagingReports": [
                {
                    "imagingOrderId": f"IMG-{row['imaging_order_id']}",
                    "reportText": row["report_text"],
                    "reportedAt": row["reported_at"],
                }
                for row in to_list(imaging_reports)
            ],
            "billing": {
                "billingStatus": billing["billing_status"] if billing else "Deposit Sufficient",
                "insuranceApproval": billing["insurance_approval"] if billing else "Not Required",
            },
            "chargeCapture": [
                {
                    "item": row["item"],
                    "amount": row["amount"],
                    "capturedAt": row["captured_at"],
                }
                for row in to_list(charges)
            ],
        },
    }


@router.put("/{patient_id}/record")
def update_patient_record(
    patient_id: int,
    payload: ClinicalRecordUpdate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        if not _patient_exists(conn, patient_id):
            raise HTTPException(status_code=404, detail="Patient not found")

        clinical = conn.execute(
            "SELECT id, chief_complaint, past_medical_history, social_family_history FROM clinical_history WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()
        if clinical is None:
            conn.execute("INSERT INTO clinical_history (patient_id) VALUES (?)", (patient_id,))
            clinical = conn.execute(
                "SELECT id, chief_complaint, past_medical_history, social_family_history FROM clinical_history WHERE patient_id = ?",
                (patient_id,),
            ).fetchone()

        chief = payload.chief_complaint
        if chief is None:
            chief = clinical["chief_complaint"]
        pmh = payload.past_medical_history
        pmh_text = clinical["past_medical_history"] if pmh is None else "\n".join(pmh)
        sfh = payload.social_family_history
        sfh_text = clinical["social_family_history"] if sfh is None else "\n".join(sfh)

        conn.execute(
            """
            UPDATE clinical_history
            SET chief_complaint = ?, past_medical_history = ?, social_family_history = ?, updated_at = CURRENT_TIMESTAMP
            WHERE patient_id = ?
            """,
            (chief, pmh_text, sfh_text, patient_id),
        )

        if payload.billing_status is not None or payload.insurance_approval is not None:
            billing = conn.execute(
                "SELECT billing_status, insurance_approval FROM billing_status WHERE patient_id = ?",
                (patient_id,),
            ).fetchone()
            if billing is None:
                conn.execute("INSERT INTO billing_status (patient_id) VALUES (?)", (patient_id,))
                billing = conn.execute(
                    "SELECT billing_status, insurance_approval FROM billing_status WHERE patient_id = ?",
                    (patient_id,),
                ).fetchone()

            billing_status = payload.billing_status or billing["billing_status"]
            insurance_approval = payload.insurance_approval or billing["insurance_approval"]
            conn.execute(
                """
                UPDATE billing_status
                SET billing_status = ?, insurance_approval = ?
                WHERE patient_id = ?
                """,
                (billing_status, insurance_approval, patient_id),
            )

        log_operation(
            conn,
            user["id"],
            "update",
            "patient_record",
            str(patient_id),
            "Updated clinical record",
        )
    return {"ok": True}


@router.post("/{patient_id}/vitals", status_code=status.HTTP_201_CREATED)
def add_vitals(
    patient_id: int,
    payload: VitalsCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        if not _patient_exists(conn, patient_id):
            raise HTTPException(status_code=404, detail="Patient not found")
        cursor = conn.execute(
            """
            INSERT INTO vitals (
              patient_id, recorded_at, blood_pressure, heart_rate, temperature, spo2, respiratory_rate, physical_findings
            ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id,
                payload.blood_pressure,
                payload.heart_rate,
                payload.temperature,
                payload.spo2,
                payload.respiratory_rate,
                payload.physical_findings,
            ),
        )
        vitals_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "vitals",
            str(vitals_id),
            "Added vitals entry",
        )
    return {"ok": True, "id": vitals_id}


@router.post("/{patient_id}/lab-orders", status_code=status.HTTP_201_CREATED)
def create_lab_order(
    patient_id: int,
    payload: LabOrderCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        if not _patient_exists(conn, patient_id):
            raise HTTPException(status_code=404, detail="Patient not found")
        cursor = conn.execute(
            """
            INSERT INTO lab_orders (patient_id, test_name, ordered_at, status)
            VALUES (?, ?, datetime('now'), ?)
            """,
            (patient_id, payload.test_name, payload.status),
        )
        lab_order_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "lab_orders",
            str(lab_order_id),
            "Created lab order",
        )
    return {"ok": True, "id": lab_order_id}


@router.post("/lab-orders/{lab_order_id}/results", status_code=status.HTTP_201_CREATED)
def add_lab_result(
    lab_order_id: int,
    payload: LabResultCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        order = conn.execute(
            "SELECT id FROM lab_orders WHERE id = ?",
            (lab_order_id,),
        ).fetchone()
        if order is None:
            raise HTTPException(status_code=404, detail="Lab order not found")

        cursor = conn.execute(
            """
            INSERT INTO lab_results (lab_order_id, result_value, result_flag, reported_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (lab_order_id, payload.result_value, payload.result_flag),
        )
        conn.execute("UPDATE lab_orders SET status = 'Completed' WHERE id = ?", (lab_order_id,))
        result_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "lab_results",
            str(result_id),
            "Added lab result",
        )
    return {"ok": True, "id": result_id}


@router.post("/{patient_id}/imaging-orders", status_code=status.HTTP_201_CREATED)
def create_imaging_order(
    patient_id: int,
    payload: ImagingOrderCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        if not _patient_exists(conn, patient_id):
            raise HTTPException(status_code=404, detail="Patient not found")
        cursor = conn.execute(
            """
            INSERT INTO imaging_orders (patient_id, imaging_type, ordered_at, status)
            VALUES (?, ?, datetime('now'), ?)
            """,
            (patient_id, payload.imaging_type, payload.status),
        )
        imaging_order_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "imaging_orders",
            str(imaging_order_id),
            "Created imaging order",
        )
    return {"ok": True, "id": imaging_order_id}


@router.post("/imaging-orders/{imaging_order_id}/reports", status_code=status.HTTP_201_CREATED)
def add_imaging_report(
    imaging_order_id: int,
    payload: ImagingReportCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        order = conn.execute(
            "SELECT id FROM imaging_orders WHERE id = ?",
            (imaging_order_id,),
        ).fetchone()
        if order is None:
            raise HTTPException(status_code=404, detail="Imaging order not found")

        cursor = conn.execute(
            """
            INSERT INTO imaging_reports (imaging_order_id, report_text, reported_at)
            VALUES (?, ?, datetime('now'))
            """,
            (imaging_order_id, payload.report_text),
        )
        conn.execute("UPDATE imaging_orders SET status = 'Reported' WHERE id = ?", (imaging_order_id,))
        report_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "imaging_reports",
            str(report_id),
            "Added imaging report",
        )
    return {"ok": True, "id": report_id}


@router.post("/{patient_id}/charges", status_code=status.HTTP_201_CREATED)
def add_charge(
    patient_id: int,
    payload: ChargeCreate,
    user=Depends(require_roles("Doctor", "Nurse", "registration_desk")),
):
    with get_connection() as conn:
        if not _patient_exists(conn, patient_id):
            raise HTTPException(status_code=404, detail="Patient not found")
        cursor = conn.execute(
            """
            INSERT INTO charges (patient_id, item, amount, captured_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (patient_id, payload.item, payload.amount),
        )
        charge_id = int(cursor.lastrowid)
        log_operation(
            conn,
            user["id"],
            "create",
            "charges",
            str(charge_id),
            f"Captured charge {payload.item}",
        )
    return {"ok": True, "id": charge_id}
