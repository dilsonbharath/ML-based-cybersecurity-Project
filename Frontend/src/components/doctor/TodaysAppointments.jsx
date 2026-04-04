function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

export default function TodaysAppointments({ appointments, selectedId, onSelect }) {
  return (
    <section className="panel">
      <h3>Today's Appointments</h3>
      {!appointments.length && (
        <p className="empty-state">No appointments assigned for today.</p>
      )}
      <div className="appt-list">
        {appointments.map((appointment) => (
          <button
            className={`appt-card ${selectedId === appointment.id ? "selected" : ""}`}
            key={appointment.id}
            onClick={() => onSelect(appointment.id)}
            type="button"
          >
            <div className="appt-main">
              <strong>{appointment.patient.fullName}</strong>
              <span>{appointment.patient.uhid}</span>
            </div>
            <div className="appt-meta">
              <span>{appointment.appointmentTime}</span>
              <span className={`status-pill ${statusClass(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
