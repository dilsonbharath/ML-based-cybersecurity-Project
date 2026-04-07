import { useEffect, useMemo, useState } from "react";
import {
  createAppointment,
  createPatient,
  getNurseSnapshot,
  getPatients,
  getStaffByShift,
  getTodaysAppointments,
  updatePatientRecord
} from "../../services/ehrService";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeName(value) {
  return (value || "").trim().toLowerCase();
}

function nextUhidFromRows(rows) {
  const currentYear = new Date().getFullYear();
  const serials = rows
    .map((row) => {
      const match = String(row.uhid || "").match(/UHID-(\d{4})-(\d+)/i);
      return match ? Number(match[2]) : null;
    })
    .filter((value) => value !== null);

  const nextSerial = serials.length ? Math.max(...serials) + 1 : 1001;
  return `UHID-${currentYear}-${String(nextSerial).padStart(4, "0")}`;
}

const SHIFT_OPTIONS = ["2-10", "10-18", "18-2"];

export default function RegistrationDeskPortal({ user }) {
  const [snapshot, setSnapshot] = useState({
    todayPatients: 0,
    pendingTasks: 0
  });
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    uhid: "",
    fullName: "",
    age: "",
    gender: "Male",
    problem: "",
    assignedNurse: "",
    assignedDoctorId: "",
    appointmentDate: todayISO(),
    appointmentTime: "09:00",
    shiftSlot: "2-10"
  });

  useEffect(() => {
    let stopped = false;

    async function loadSnapshot() {
      try {
        const data = await getNurseSnapshot();
        if (!stopped) {
          setSnapshot(data);
        }
      } catch {
        if (!stopped) {
          setSnapshot({ todayPatients: 0, pendingTasks: 0 });
        }
      }
    }

    async function loadShiftStaff() {
      try {
        const rows = await getStaffByShift(form.shiftSlot);
        if (!stopped) {
          setDoctors(rows.doctors || []);
          setNurses(rows.nurses || []);
          setForm((prev) => ({
            ...prev,
            assignedDoctorId: rows.doctors?.length ? String(rows.doctors[0].id) : "",
            assignedNurse: rows.nurses?.length ? rows.nurses[0].full_name : ""
          }));
        }
      } catch {
        if (!stopped) {
          setDoctors([]);
          setNurses([]);
        }
      }
    }

    async function loadRecentPatients() {
      try {
        const rows = await getPatients("");
        if (!stopped) {
          setAllPatients(rows);
          setForm((prev) => ({ ...prev, uhid: nextUhidFromRows(rows) }));
        }
      } catch {
        if (!stopped) {
          setAllPatients([]);
        }
      }
    }

    async function loadTodaysAppointments() {
      try {
        const rows = await getTodaysAppointments();
        if (!stopped) {
          setTodayAppointments(rows);
        }
      } catch {
        if (!stopped) {
          setTodayAppointments([]);
        }
      }
    }

    loadSnapshot();
    loadShiftStaff();
    loadRecentPatients();
    loadTodaysAppointments();

    const timer = setInterval(loadSnapshot, 12000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [form.shiftSlot]);

  const selectedDoctorName = useMemo(() => {
    const match = doctors.find((row) => String(row.id) === String(form.assignedDoctorId));
    return match?.full_name || "Not selected";
  }, [doctors, form.assignedDoctorId]);

  const visiblePatients = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const activeAppointments = todayAppointments.filter((row) => row.status !== "Completed");
    const source = activeAppointments
      .map((appt) => {
        const patient = allPatients.find((row) => row.id === appt.patientId);
        if (!patient) {
          return null;
        }
        return {
          ...patient,
          appointmentStatus: appt.status
        };
      })
      .filter(Boolean);

    if (!normalized) return source;
    return source.filter(
      (row) =>
        String(row.full_name || "").toLowerCase().includes(normalized) ||
        String(row.uhid || "").toLowerCase().includes(normalized)
    );
  }, [allPatients, todayAppointments, search]);

  function updateField(name, value) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "fullName") {
        const matched = allPatients.find((row) => normalizeName(row.full_name) === normalizeName(value));
        if (matched) {
          next.age = String(matched.age || "");
          next.gender = matched.gender || prev.gender;
        }
      }
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.assignedDoctorId) {
      setError("Please assign a doctor.");
      return;
    }

    if (!form.assignedNurse) {
      setError("Please assign a nurse.");
      return;
    }

    setSubmitting(true);
    try {
      const appointmentDate = form.appointmentDate;
      const incomingName = normalizeName(form.fullName);
      const alreadyBookedToday = todayAppointments.some(
        (row) => row.appointmentDate === appointmentDate && normalizeName(row.patient?.fullName) === incomingName
      );

      if (alreadyBookedToday) {
        setError("This patient already has an appointment on the selected date.");
        setSubmitting(false);
        return;
      }

      const existingPatient = allPatients.find((row) => normalizeName(row.full_name) === incomingName);

      let patientId = existingPatient?.id;
      if (!patientId) {
        const created = await createPatient({
          uhid: form.uhid.trim(),
          full_name: form.fullName.trim(),
          age: Number(form.age),
          gender: form.gender,
          assigned_doctor_id: Number(form.assignedDoctorId)
        });
        patientId = created.id;
      }

      await updatePatientRecord(patientId, {
        chief_complaint: form.problem.trim(),
        past_medical_history: [],
        social_family_history: []
      });

      await createAppointment({
        patient_id: patientId,
        doctor_id: Number(form.assignedDoctorId),
        appointment_date: form.appointmentDate,
        appointment_time: form.appointmentTime,
        status: "Scheduled"
      });

      setMessage("Patient registered and assigned successfully.");
      setForm({
        uhid: "",
        fullName: "",
        age: "",
        gender: "Male",
        problem: "",
        assignedNurse: form.assignedNurse || nurses[0]?.full_name || "",
        assignedDoctorId: form.assignedDoctorId,
        appointmentDate: todayISO(),
        appointmentTime: "09:00",
        shiftSlot: form.shiftSlot
      });

      const refreshedPatients = await getPatients("");
      setAllPatients(refreshedPatients);
      setForm((prev) => ({ ...prev, uhid: nextUhidFromRows(refreshedPatients) }));
      const refreshedAppointments = await getTodaysAppointments();
      setTodayAppointments(refreshedAppointments);
    } catch (submitError) {
      setError(submitError.message || "Unable to register patient.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="portal-shell">
      <div className="portal-header">
        <h2>Registration Desk Workspace</h2>
        <p>{user.name}</p>
        <span className="live-tag inline">Patient intake and doctor assignment</span>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span>Today Patients</span>
          <strong>{snapshot.todayPatients}</strong>
        </article>
        <article className="stat-card">
          <span>Pending Tasks</span>
          <strong>{snapshot.pendingTasks}</strong>
        </article>
      </div>

      <section className="panel">
        <h3>Register Patient and Assign Doctor</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="record-grid">
            <label>
              UHID
              <input
                name="uhid"
                placeholder="Auto generated"
                required
                readOnly
                type="text"
                value={form.uhid}
              />
            </label>

            <label>
              Patient Name
              <input
                name="fullName"
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Enter full name"
                required
                type="text"
                value={form.fullName}
              />
            </label>

            <label>
              Age
              <input
                min="1"
                name="age"
                onChange={(event) => updateField("age", event.target.value)}
                placeholder="Age"
                required
                type="number"
                value={form.age}
              />
            </label>

            <label>
              Gender
              <select
                name="gender"
                onChange={(event) => updateField("gender", event.target.value)}
                value={form.gender}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Shift Slot
              <select
                name="shiftSlot"
                onChange={(event) => updateField("shiftSlot", event.target.value)}
                required
                value={form.shiftSlot}
              >
                {SHIFT_OPTIONS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assign Doctor
              <select
                name="assignedDoctorId"
                onChange={(event) => updateField("assignedDoctorId", event.target.value)}
                required
                value={form.assignedDoctorId}
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assign Nurse (Vitals)
              <select
                name="assignedNurse"
                onChange={(event) => updateField("assignedNurse", event.target.value)}
                required
                value={form.assignedNurse}
              >
                {!nurses.length && <option value="">No active nurses found</option>}
                {nurses.map((nurse) => (
                  <option key={nurse.id} value={nurse.full_name}>
                    {nurse.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Appointment Date
              <input
                name="appointmentDate"
                onChange={(event) => updateField("appointmentDate", event.target.value)}
                required
                type="date"
                value={form.appointmentDate}
              />
            </label>

            <label>
              Appointment Time
              <input
                name="appointmentTime"
                onChange={(event) => updateField("appointmentTime", event.target.value)}
                required
                type="time"
                value={form.appointmentTime}
              />
            </label>
          </div>

          <label>
            Problem / Chief Complaint
            <textarea
              name="problem"
              onChange={(event) => updateField("problem", event.target.value)}
              placeholder="Describe the patient's problem"
              required
              rows={3}
              value={form.problem}
            />
          </label>

          <p className="notice">Assigned doctor: {selectedDoctorName}</p>
          {message && <p className="notice">{message}</p>}
          {error && <p className="error">{error}</p>}

          <button className="btn primary" disabled={submitting} type="submit">
            {submitting ? "Saving..." : "Register Patient"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h3>Today's / Allocated Patients</h3>
        <div className="panel-header-row">
          <label>
            Search
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or UHID"
              type="text"
              value={search}
            />
          </label>
        </div>

        {!visiblePatients.length && <p className="empty-state">No patient records found.</p>}
        {!!visiblePatients.length && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>UHID</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Assigned Doctor</th>
                  <th>Assigned Nurse</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map((row) => (
                  <tr key={row.id}>
                    <td>{row.uhid}</td>
                    <td>{row.full_name}</td>
                    <td>{row.age}</td>
                    <td>{row.gender}</td>
                    <td>{row.assigned_doctor_name}</td>
                    <td>{row.medcare_nurse_name || "-"}</td>
                    <td>{row.appointmentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
