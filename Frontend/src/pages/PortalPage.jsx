import RolePortal from "../components/roles/RolePortal";

export default function PortalPage({ user }) {
  return (
    <main className="page-shell">
      <RolePortal user={user} />
    </main>
  );
}
