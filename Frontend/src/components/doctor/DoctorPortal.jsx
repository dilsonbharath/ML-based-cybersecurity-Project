import { useEffect, useMemo, useState } from "react";
import { getPatientRecord, subscribeDoctorAppointments } from "../../services/hmisService";
import PatientRecord from "./PatientRecord";
import PatientOperationsPanel from "../shared/PatientOperationsPanel";
import TodaysAppointments from "./TodaysAppointments";

function summarize(appointments) {
  return {
    total: appointments.length,
    scheduled: appointments.filter((item) => item.status === "Scheduled").length,
    checkedIn: appointments.filter((item) => item.status === "Checked In").length,
    inConsultation: appointments.filter((item) => item.status === "In Consultation").length
  };
}

export default function DoctorPortal({ user }) {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [patientRecord, setPatientRecord] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeDoctorAppointments(user, setAppointments);
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!appointments.length) {
      setSelectedAppointmentId(null);
      return;
    }
    const selectedExists = appointments.some((item) => item.id === selectedAppointmentId);
    if (!selectedExists) {
      setSelectedAppointmentId(appointments[0].id);
    }
  }, [appointments, selectedAppointmentId]);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === selectedAppointmentId) || null,
    [appointments, selectedAppointmentId]
  );

  useEffect(() => {
    let ignore = false;
    async function loadRecord() {
      if (!selectedAppointment) {
        setPatientRecord(null);
        return;
      }
      setRecordLoading(true);
      try {
        const data = await getPatientRecord(selectedAppointment.patientId);
        if (!ignore) {
          setPatientRecord(data);
        }
      } catch {
        if (!ignore) {
          setPatientRecord(null);
        }
      } finally {
        if (!ignore) {
          setRecordLoading(false);
        }
      }
    }
    loadRecord();
    return () => {
      ignore = true;
    };
  }, [selectedAppointment]);

  const summary = useMemo(() => summarize(appointments), [appointments]);

  return (
    <section className="portal-shell">
      <div className="portal-header">
        <h2>Doctor Workspace</h2>
        <p>{user.name}</p>
        <span className="live-tag inline">Live updates every 4s</span>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span>Total Today</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="stat-card">
          <span>Scheduled</span>
          <strong>{summary.scheduled}</strong>
        </article>
        <article className="stat-card">
          <span>Checked In</span>
          <strong>{summary.checkedIn}</strong>
        </article>
        <article className="stat-card">
          <span>In Consultation</span>
          <strong>{summary.inConsultation}</strong>
        </article>
      </div>

      <div className="doctor-layout">
        <TodaysAppointments
          appointments={appointments}
          onSelect={setSelectedAppointmentId}
          selectedId={selectedAppointmentId}
        />
        <PatientRecord
          appointment={selectedAppointment}
          loading={recordLoading}
          patientRecord={patientRecord}
        />
      </div>

      <PatientOperationsPanel user={user} />
    </section>
  );
}
