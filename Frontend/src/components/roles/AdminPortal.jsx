import { useEffect, useState } from "react";
import { getAdminSnapshot, getRecentOperations } from "../../services/hmisService";

export default function AdminPortal({ user }) {
  const [snapshot, setSnapshot] = useState({
    todaysFootfall: 0,
    consultationsCompleted: 0
  });
  const [operations, setOperations] = useState([]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const [stats, ops] = await Promise.all([getAdminSnapshot(), getRecentOperations(12)]);
        if (!stopped) {
          setSnapshot(stats);
          setOperations(ops);
        }
      } catch {
        if (!stopped) {
          setOperations([]);
        }
      }
    }
    load();
    const timer = setInterval(load, 6000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="portal-shell">
      <div className="portal-header">
        <h2>Administrator Workspace</h2>
        <p>{user.name}</p>
        <span className="live-tag inline">Live operations feed</span>
      </div>
      <div className="stat-grid">
        <article className="stat-card">
          <span>Today's Footfall</span>
          <strong>{snapshot.todaysFootfall}</strong>
        </article>
        <article className="stat-card">
          <span>Consultations Completed</span>
          <strong>{snapshot.consultationsCompleted}</strong>
        </article>
      </div>

      <section className="panel">
        <h3>Recent Operations</h3>
        {!operations.length && <p className="empty-state">No operations yet.</p>}
        {!!operations.length && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((row) => (
                  <tr key={row.id}>
                    <td>{row.created_at}</td>
                    <td>{row.user_name}</td>
                    <td>{row.action}</td>
                    <td>
                      {row.entity_type} ({row.entity_id})
                    </td>
                    <td>{row.details}</td>
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
