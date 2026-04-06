import { useEffect, useState } from "react";
import { getRoleWiseUsers } from "../../services/ehrService";

export default function AdminPortal({ user }) {
  const [roleWiseUsers, setRoleWiseUsers] = useState([]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const grouped = await getRoleWiseUsers();
        if (!stopped) {
          setRoleWiseUsers(grouped);
        }
      } catch {
        if (!stopped) {
          setRoleWiseUsers([]);
        }
      }
    }
    load();
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <section className="portal-shell">
      <div className="portal-header">
        <h2>Administrator Workspace</h2>
        <p>{user.name}</p>
      </div>

      <section className="panel">
        <h3>Role-wise Users</h3>
        {!roleWiseUsers.length && <p className="empty-state">No active users found.</p>}
        {!!roleWiseUsers.length && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Count</th>
                  <th>Users</th>
                </tr>
              </thead>
              <tbody>
                {roleWiseUsers.map((group) => (
                  <tr key={group.role}>
                    <td>{group.role}</td>
                    <td>{group.count}</td>
                    <td>{group.users.map((member) => member.full_name).join(", ") || "-"}</td>
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
