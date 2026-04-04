import { useEffect, useState } from "react";
import { getNurseSnapshot } from "../../services/hmisService";
import PatientOperationsPanel from "../shared/PatientOperationsPanel";

export default function NursePortal({ user }) {
  const [snapshot, setSnapshot] = useState({
    todayPatients: 0,
    pendingTasks: 0
  });

  useEffect(() => {
    let stopped = false;

    async function load() {
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

    load();
    const timer = setInterval(load, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="portal-shell">
      <div className="portal-header">
        <h2>Nurse Workspace</h2>
        <p>{user.name}</p>
        <span className="live-tag inline">Live updates every 5s</span>
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

      <PatientOperationsPanel user={user} />
    </section>
  );
}
