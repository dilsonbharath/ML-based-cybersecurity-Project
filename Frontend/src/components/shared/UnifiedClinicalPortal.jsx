import { useEffect, useMemo, useState } from "react";
import {
  addVitals,
  getAppointments,
  getPatientRecord,
  getPatients,
  updateAppointmentStatus,
  updatePatient,
  updatePatientRecord
} from "../../services/ehrService";

function prefixed(items, prefix) {
  return (items || [])
    .filter((item) => String(item || "").toLowerCase().startsWith(prefix.toLowerCase()))
    .map((item) => String(item).slice(prefix.length).trim())
    .filter(Boolean)
    .join("\n");
}

function firstVitals(record) {
  return (record?.vitals || [])[0] || null;
}

function finding(text, key) {
  const m = String(text || "").match(new RegExp(`${key}:\\s*([^|]+)`, "i"));
  return m ? m[1].trim() : "";
}

export default function UnifiedClinicalPortal({ user }) {
  const isDoctor = user.role === "Doctor";
  const [tab, setTab] = useState("patients");
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [record, setRecord] = useState(null);
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [col1, setCol1] = useState({
    uhid: "",
    full_name: "",
    age: "",
    gender: "Male",
    chiefComplaint: "",
    assigned_doctor_name: "",
    medcare_nurse_name: ""
  });
  const [col2, setCol2] = useState({
    bloodGroup: "",
    sugar: "",
    bloodPressure: "",
    heartRate: "",
    weight: "",
    height: ""
  });
  const [col3, setCol3] = useState({
    pastMedicalHistory: "",
    xrayReports: "",
    medicalReports: "",
    medicines: "",
    extraInfo: "",
    cautions: ""
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [patientRows, appointmentRows] = await Promise.all([getPatients(""), getAppointments()]);
        if (!ignore) {
          setPatients(patientRows);
          setAppointments(appointmentRows);
        }
      } catch (e) {
        if (!ignore) {
          setError(e.message || "Unable to load data.");
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const patientTabRows = useMemo(
    () => appointments.filter((a) => a.status !== "Completed"),
    [appointments]
  );

  const recordsRows = useMemo(() => {
    const needle = appliedQ.trim().toLowerCase();
    return appointments.filter((a) => {
      const name = (a.patient?.fullName || "").toLowerCase();
      const uhid = (a.patient?.uhid || "").toLowerCase();
      const byText = !needle || name.includes(needle) || uhid.includes(needle);
      const byDate = !appliedDate || a.appointmentDate === appliedDate;
      return byText && byDate;
    });
  }, [appointments, appliedQ, appliedDate]);

  async function selectAppointment(row) {
    if (selectedAppointment?.id === row.id) {
      setSelectedAppointment(null);
      setRecord(null);
      return;
    }
    setSelectedAppointment(row);
    const p = patientMap.get(row.patientId);
    try {
      const payload = await getPatientRecord(row.patientId);
      const rec = payload.record || {};
      const v = firstVitals(rec);
      setRecord(rec);
      setCol1({
        uhid: p?.uhid || row.patient?.uhid || "",
        full_name: p?.full_name || row.patient?.fullName || "",
        age: String(p?.age || ""),
        gender: p?.gender || "Male",
        chiefComplaint: rec.chiefComplaint || "",
        assigned_doctor_name: p?.assigned_doctor_name || "",
        medcare_nurse_name: p?.medcare_nurse_name || ""
      });
      setCol2({
        bloodGroup: finding(v?.physicalFindings, "Blood Group"),
        sugar: finding(v?.physicalFindings, "Sugar"),
        bloodPressure: v?.bloodPressure || "",
        heartRate: v?.heartRate || "",
        weight: finding(v?.physicalFindings, "Weight"),
        height: finding(v?.physicalFindings, "Height")
      });
      setCol3({
        pastMedicalHistory: (rec.pastMedicalHistory || []).join("\n"),
        xrayReports: prefixed(rec.socialFamilyHistory, "X-ray:"),
        medicalReports: prefixed(rec.socialFamilyHistory, "Report:"),
        medicines: prefixed(rec.socialFamilyHistory, "Medicine:"),
        extraInfo: prefixed(rec.socialFamilyHistory, "Extra:"),
        cautions: prefixed(rec.socialFamilyHistory, "Caution:")
      });
    } catch (e) {
      setError(e.message || "Unable to open record.");
    }
  }

  async function saveColumn1() {
    if (!selectedAppointment) return;
    setError("");
    setMessage("");
    try {
      await updatePatient(selectedAppointment.patientId, {
        uhid: col1.uhid.trim(),
        full_name: col1.full_name.trim(),
        age: Number(col1.age),
        gender: col1.gender
      });
      await updatePatientRecord(selectedAppointment.patientId, { chief_complaint: col1.chiefComplaint });
      setMessage("Column 1 saved.");
    } catch (e) {
      setError(e.message || "Unable to save column 1.");
    }
  }

  async function saveColumn2() {
    if (!selectedAppointment) return;
    setError("");
    setMessage("");
    try {
      const findings = [
        col2.bloodGroup ? `Blood Group: ${col2.bloodGroup}` : "",
        col2.sugar ? `Sugar: ${col2.sugar}` : "",
        col2.weight ? `Weight: ${col2.weight}` : "",
        col2.height ? `Height: ${col2.height}` : ""
      ]
        .filter(Boolean)
        .join(" | ");
      await addVitals(selectedAppointment.patientId, {
        blood_pressure: col2.bloodPressure || "Not Provided",
        heart_rate: col2.heartRate || "Not Provided",
        temperature: "Not Provided",
        spo2: "Not Provided",
        respiratory_rate: "Not Provided",
        physical_findings: findings
      });
      setMessage("Column 2 saved.");
    } catch (e) {
      setError(e.message || "Unable to save column 2.");
    }
  }

  async function saveColumn3() {
    if (!selectedAppointment || !isDoctor) return;
    setError("");
    setMessage("");
    try {
      const social = [
        ...col3.xrayReports.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `X-ray: ${x}`),
        ...col3.medicalReports.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `Report: ${x}`),
        ...col3.medicines.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `Medicine: ${x}`),
        ...col3.extraInfo.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `Extra: ${x}`),
        ...col3.cautions.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `Caution: ${x}`)
      ];
      await updatePatientRecord(selectedAppointment.patientId, {
        past_medical_history: col3.pastMedicalHistory.split("\n").map((x) => x.trim()).filter(Boolean),
        social_family_history: social
      });
      setMessage("Column 3 saved.");
    } catch (e) {
      setError(e.message || "Unable to save column 3.");
    }
  }

  async function changeStatus(status) {
    if (!selectedAppointment) return;
    try {
      await updateAppointmentStatus(selectedAppointment.id, status);
      setAppointments((prev) => prev.map((a) => (a.id === selectedAppointment.id ? { ...a, status } : a)));
      setSelectedAppointment((prev) => (prev ? { ...prev, status } : prev));
    } catch (e) {
      setError(e.message || "Unable to update status.");
    }
  }

  return (
    <section className="panel unified-clinical">
      <div className="panel-header-row">
        <h3>{isDoctor ? "Doctor Portal" : "Nurse Portal"}</h3>
        <div className="panel-actions-row">
          <button className={`btn ${tab === "patients" ? "primary" : "subtle"}`} onClick={() => setTab("patients")} type="button">
            Patients
          </button>
          <button className={`btn ${tab === "records" ? "primary" : "subtle"}`} onClick={() => setTab("records")} type="button">
            Records
          </button>
        </div>
      </div>

      {tab === "records" && (
        <div className="form-grid compact" style={{ gridTemplateColumns: "220px 1fr auto" }}>
          <label>
            Date
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </label>
          <label>
            Search by UHID or Name
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="UHID / Name" />
          </label>
          <button className="btn subtle" type="button" onClick={() => { setAppliedDate(dateFilter); setAppliedQ(q); }}>
            Search
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>UHID</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(tab === "patients" ? patientTabRows : recordsRows).map((row) => (
              <tr
                key={row.id}
                className={`selectable-row ${selectedAppointment?.id === row.id ? "selected" : ""}`}
                onClick={() => selectAppointment(row)}
              >
                <td>{row.patient?.fullName || "-"}</td>
                <td>{row.patient?.uhid || "-"}</td>
                <td>{row.appointmentDate}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedAppointment && (
        <div className="unified-columns">
          <article className="form-block">
            <h4>Column 1 - Basic + Assignment</h4>
            <div className="form-grid compact">
              <input value={col1.uhid} onChange={(e) => setCol1((p) => ({ ...p, uhid: e.target.value }))} placeholder="UHID" />
              <input value={col1.full_name} onChange={(e) => setCol1((p) => ({ ...p, full_name: e.target.value }))} placeholder="Name" />
              <input value={col1.age} onChange={(e) => setCol1((p) => ({ ...p, age: e.target.value }))} placeholder="Age" type="number" />
              <select value={col1.gender} onChange={(e) => setCol1((p) => ({ ...p, gender: e.target.value }))}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              <input value={col1.assigned_doctor_name} disabled placeholder="Assigned Doctor" />
              <input value={col1.medcare_nurse_name} disabled placeholder="Assigned Nurse" />
              <textarea value={col1.chiefComplaint} onChange={(e) => setCol1((p) => ({ ...p, chiefComplaint: e.target.value }))} rows={2} placeholder="Health issue / chief complaint" />
              <button className="btn subtle" type="button" onClick={saveColumn1}>Save Column 1</button>
            </div>
          </article>

          <article className="form-block">
            <h4>Column 2 - Vitals</h4>
            <div className="form-grid compact">
              <input value={col2.bloodGroup} onChange={(e) => setCol2((p) => ({ ...p, bloodGroup: e.target.value }))} placeholder="Blood Group" />
              <input value={col2.sugar} onChange={(e) => setCol2((p) => ({ ...p, sugar: e.target.value }))} placeholder="Sugar" />
              <input value={col2.bloodPressure} onChange={(e) => setCol2((p) => ({ ...p, bloodPressure: e.target.value }))} placeholder="Pressure" />
              <input value={col2.heartRate} onChange={(e) => setCol2((p) => ({ ...p, heartRate: e.target.value }))} placeholder="Heart Rate" />
              <input value={col2.weight} onChange={(e) => setCol2((p) => ({ ...p, weight: e.target.value }))} placeholder="Weight" />
              <input value={col2.height} onChange={(e) => setCol2((p) => ({ ...p, height: e.target.value }))} placeholder="Height" />
              <button className="btn subtle" type="button" onClick={saveColumn2}>Save Column 2</button>
            </div>
          </article>

          <article className="form-block">
            <h4>Column 3 - Doctor Notes</h4>
            <div className="form-grid compact">
              <textarea disabled={!isDoctor} value={col3.pastMedicalHistory} onChange={(e) => setCol3((p) => ({ ...p, pastMedicalHistory: e.target.value }))} rows={2} placeholder="Past medical history" />
              <textarea disabled={!isDoctor} value={col3.xrayReports} onChange={(e) => setCol3((p) => ({ ...p, xrayReports: e.target.value }))} rows={2} placeholder="Xray reports" />
              <textarea disabled={!isDoctor} value={col3.medicalReports} onChange={(e) => setCol3((p) => ({ ...p, medicalReports: e.target.value }))} rows={2} placeholder="Medical reports" />
              <textarea disabled={!isDoctor} value={col3.medicines} onChange={(e) => setCol3((p) => ({ ...p, medicines: e.target.value }))} rows={2} placeholder="Medicines" />
              <textarea disabled={!isDoctor} value={col3.extraInfo} onChange={(e) => setCol3((p) => ({ ...p, extraInfo: e.target.value }))} rows={2} placeholder="Extra information" />
              <textarea disabled={!isDoctor} value={col3.cautions} onChange={(e) => setCol3((p) => ({ ...p, cautions: e.target.value }))} rows={2} placeholder="Advices / cautions" />
              <button className="btn subtle" disabled={!isDoctor} type="button" onClick={saveColumn3}>
                Save Column 3
              </button>
            </div>
          </article>
        </div>
      )}

      {selectedAppointment && (
        <div className="form-block">
          <h4>Status Check-In</h4>
          <div className="status-radio-row">
            {["Scheduled", "Checked In", "In Consultation", "Completed"].map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="visit-status"
                  checked={selectedAppointment.status === s}
                  onChange={() => changeStatus(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
