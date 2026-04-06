import PatientOperationsPanel from "../shared/PatientOperationsPanel";

export default function NursePortal({ user }) {
  return (
    <section className="portal-shell doctor-portal-compact">
      <div className="portal-header">
        <h2>Nurse Workspace</h2>
        <p>{user.name}</p>
      </div>

      <PatientOperationsPanel user={user} />
    </section>
  );
}
