import { useEffect, useMemo, useState } from "react";
import {
  addVitals,
  createPatient,
  getDoctors,
  getPatientRecord,
  getPatients,
  updatePatient,
  updatePatientRecord
} from "../../services/hmisService";

function splitLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function PatientOperationsPanel({ user }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [createForm, setCreateForm] = useState({
    uhid: "",
    fullName: "",
    age: "",
    gender: "Male",
    assignedDoctorId: ""
  });
  const [editForm, setEditForm] = useState({
    uhid: "",
    fullName: "",
    age: "",
    gender: "Male",
    assignedDoctorId: ""
  });
  const [recordForm, setRecordForm] = useState({
    chiefComplaint: "",
    pastMedicalHistory: "",
    socialFamilyHistory: ""
  });
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "",
    heartRate: "",
    temperature: "",
    spo2: "",
    respiratoryRate: "",
    physicalFindings: ""
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [patientRows, doctorRows] = await Promise.all([getPatients(search), getDoctors()]);
        if (ignore) {
          return;
        }
        setPatients(patientRows);
        setDoctors(doctorRows);
        if (!selectedPatientId && patientRows.length) {
          setSelectedPatientId(patientRows[0].id);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [search, refreshKey]);

  const selectedPatient = useMemo(
    () => patients.find((item) => item.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  useEffect(() => {
    if (!patients.length) {
      setSelectedPatientId(null);
      return;
    }
    const exists = patients.some((item) => item.id === selectedPatientId);
    if (!exists) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }
    setEditForm({
      uhid: selectedPatient.uhid,
      fullName: selectedPatient.full_name,
      age: String(selectedPatient.age),
      gender: selectedPatient.gender,
      assignedDoctorId: String(selectedPatient.assigned_doctor_id)
    });
  }, [selectedPatient]);

  useEffect(() => {
    let ignore = false;
    async function loadRecord() {
      if (!selectedPatientId) {
        return;
      }
      try {
        const data = await getPatientRecord(selectedPatientId);
        if (ignore) {
          return;
        }
        setRecordForm({
          chiefComplaint: data.record.chiefComplaint || "",
          pastMedicalHistory: (data.record.pastMedicalHistory || []).join("\n"),
          socialFamilyHistory: (data.record.socialFamilyHistory || []).join("\n")
        });
      } catch {
        if (!ignore) {
          setRecordForm({
            chiefComplaint: "",
            pastMedicalHistory: "",
            socialFamilyHistory: ""
          });
        }
      }
    }
    loadRecord();
    return () => {
      ignore = true;
    };
  }, [selectedPatientId]);

  function mutateCreateForm(name, value) {
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  }

  function mutateEditForm(name, value) {
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = {
        uhid: createForm.uhid.trim(),
        full_name: createForm.fullName.trim(),
        age: Number(createForm.age),
        gender: createForm.gender,
        assigned_doctor_id:
          user.role === "Doctor" ? user.id : toNumber(createForm.assignedDoctorId)
      };
      const created = await createPatient(payload);
      setMessage("Patient added successfully.");
      setCreateForm({
        uhid: "",
        fullName: "",
        age: "",
        gender: "Male",
        assignedDoctorId: ""
      });
      setRefreshKey((value) => value + 1);
      if (created?.id) {
        setSelectedPatientId(created.id);
      }
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to edit.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await updatePatient(selectedPatientId, {
        uhid: editForm.uhid.trim(),
        full_name: editForm.fullName.trim(),
        age: Number(editForm.age),
        gender: editForm.gender,
        assigned_doctor_id:
          user.role === "Doctor" ? user.id : toNumber(editForm.assignedDoctorId)
      });
      setMessage("Patient demographics updated.");
      setRefreshKey((value) => value + 1);
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function handleRecordUpdate(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to update record.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await updatePatientRecord(selectedPatientId, {
        chief_complaint: recordForm.chiefComplaint,
        past_medical_history: splitLines(recordForm.pastMedicalHistory),
        social_family_history: splitLines(recordForm.socialFamilyHistory)
      });
      setMessage("Clinical record updated.");
    } catch (recordError) {
      setError(recordError.message);
    }
  }

  async function handleVitals(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to add vitals.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await addVitals(selectedPatientId, {
        blood_pressure: vitalsForm.bloodPressure,
        heart_rate: vitalsForm.heartRate,
        temperature: vitalsForm.temperature,
        spo2: vitalsForm.spo2,
        respiratory_rate: vitalsForm.respiratoryRate,
        physical_findings: vitalsForm.physicalFindings
      });
      setVitalsForm({
        bloodPressure: "",
        heartRate: "",
        temperature: "",
        spo2: "",
        respiratoryRate: "",
        physicalFindings: ""
      });
      setMessage("Vitals saved to database.");
    } catch (vitalsError) {
      setError(vitalsError.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header-row">
        <h3>Patient Operations</h3>
        <p className="live-tag">Live DB connected</p>
      </div>

      <div className="patient-ops-layout">
        <div className="patient-list-side">
          <label>
            Search Patient
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or UHID"
              type="text"
              value={search}
            />
          </label>
          <div className="patient-list">
            {loading && <p className="empty-state">Loading patients...</p>}
            {!loading &&
              patients.map((patient) => (
                <button
                  className={`appt-card ${selectedPatientId === patient.id ? "selected" : ""}`}
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  type="button"
                >
                  <div className="appt-main">
                    <strong>{patient.full_name}</strong>
                    <span>{patient.uhid}</span>
                  </div>
                  <div className="appt-meta">
                    <span>{patient.gender}</span>
                    <span>Age {patient.age}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>

        <div className="patient-forms-side">
          <div className="form-block">
            <h4>Add New Patient</h4>
            <form className="form-grid compact" onSubmit={handleCreate}>
              <input
                onChange={(event) => mutateCreateForm("uhid", event.target.value)}
                placeholder="UHID"
                required
                type="text"
                value={createForm.uhid}
              />
              <input
                onChange={(event) => mutateCreateForm("fullName", event.target.value)}
                placeholder="Full Name"
                required
                type="text"
                value={createForm.fullName}
              />
              <input
                min="1"
                onChange={(event) => mutateCreateForm("age", event.target.value)}
                placeholder="Age"
                required
                type="number"
                value={createForm.age}
              />
              <select
                onChange={(event) => mutateCreateForm("gender", event.target.value)}
                value={createForm.gender}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              {user.role === "Nurse" && (
                <select
                  onChange={(event) => mutateCreateForm("assignedDoctorId", event.target.value)}
                  required
                  value={createForm.assignedDoctorId}
                >
                  <option value="">Assign Doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn primary" type="submit">
                Add Patient
              </button>
            </form>
          </div>

          {selectedPatient && (
            <>
              <div className="form-block">
                <h4>Edit Patient</h4>
                <form className="form-grid compact" onSubmit={handleUpdate}>
                  <input
                    onChange={(event) => mutateEditForm("uhid", event.target.value)}
                    required
                    type="text"
                    value={editForm.uhid}
                  />
                  <input
                    onChange={(event) => mutateEditForm("fullName", event.target.value)}
                    required
                    type="text"
                    value={editForm.fullName}
                  />
                  <input
                    min="1"
                    onChange={(event) => mutateEditForm("age", event.target.value)}
                    required
                    type="number"
                    value={editForm.age}
                  />
                  <select
                    onChange={(event) => mutateEditForm("gender", event.target.value)}
                    value={editForm.gender}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                  {user.role === "Nurse" && (
                    <select
                      onChange={(event) => mutateEditForm("assignedDoctorId", event.target.value)}
                      required
                      value={editForm.assignedDoctorId}
                    >
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="btn subtle" type="submit">
                    Save Demographics
                  </button>
                </form>
              </div>

              <div className="form-block">
                <h4>Edit Clinical Record</h4>
                <form className="form-grid compact" onSubmit={handleRecordUpdate}>
                  <textarea
                    onChange={(event) =>
                      setRecordForm((prev) => ({ ...prev, chiefComplaint: event.target.value }))
                    }
                    placeholder="Chief Complaint"
                    rows={2}
                    value={recordForm.chiefComplaint}
                  />
                  <textarea
                    onChange={(event) =>
                      setRecordForm((prev) => ({
                        ...prev,
                        pastMedicalHistory: event.target.value
                      }))
                    }
                    placeholder="Past Medical History (one per line)"
                    rows={3}
                    value={recordForm.pastMedicalHistory}
                  />
                  <textarea
                    onChange={(event) =>
                      setRecordForm((prev) => ({
                        ...prev,
                        socialFamilyHistory: event.target.value
                      }))
                    }
                    placeholder="Social / Family History (one per line)"
                    rows={3}
                    value={recordForm.socialFamilyHistory}
                  />
                  <button className="btn subtle" type="submit">
                    Save Clinical Record
                  </button>
                </form>
              </div>

              <div className="form-block">
                <h4>Add Vitals</h4>
                <form className="form-grid compact vitals-grid" onSubmit={handleVitals}>
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, bloodPressure: event.target.value }))
                    }
                    placeholder="BP (e.g. 120/80)"
                    required
                    type="text"
                    value={vitalsForm.bloodPressure}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, heartRate: event.target.value }))
                    }
                    placeholder="Heart Rate"
                    required
                    type="text"
                    value={vitalsForm.heartRate}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, temperature: event.target.value }))
                    }
                    placeholder="Temperature"
                    required
                    type="text"
                    value={vitalsForm.temperature}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, spo2: event.target.value }))
                    }
                    placeholder="SpO2"
                    required
                    type="text"
                    value={vitalsForm.spo2}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, respiratoryRate: event.target.value }))
                    }
                    placeholder="Respiratory Rate"
                    required
                    type="text"
                    value={vitalsForm.respiratoryRate}
                  />
                  <textarea
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, physicalFindings: event.target.value }))
                    }
                    placeholder="Physical Findings"
                    rows={2}
                    value={vitalsForm.physicalFindings}
                  />
                  <button className="btn primary" type="submit">
                    Save Vitals
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {message && <p className="notice mt-12">{message}</p>}
      {error && <p className="error mt-12">{error}</p>}
    </section>
  );
}
