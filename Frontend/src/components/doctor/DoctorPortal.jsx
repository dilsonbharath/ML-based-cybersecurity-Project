import UnifiedClinicalPortal from "../shared/UnifiedClinicalPortal";

export default function DoctorPortal({ user }) {
  return (
    <section className="portal-shell doctor-portal-compact">
      <div className="portal-header">
        <h2>Doctor Workspace</h2>
        <p>{user.name}</p>
      </div>

      <UnifiedClinicalPortal user={user} />
    </section>
  );
}
