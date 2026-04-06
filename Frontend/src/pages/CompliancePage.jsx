import { Link } from "react-router-dom";
import PublicFooter from "../components/layout/PublicFooter";

export default function CompliancePage({ user }) {
  return (
    <main className="page-shell">
      <section className="marketing-hero">
        <div>
          <p className="eyebrow">Compliance and Governance</p>
          <h1>Built for audit-ready healthcare operations</h1>
          <p>
            Hospitals and healthcare practices can maintain governance discipline with standardized
            workflows, clear permissions, and complete patient activity transparency.
          </p>
          <div className="actions">
            <Link className="btn primary" to={user ? "/portal" : "/signup"}>
              {user ? "Manage Operations" : "Start Compliance-Ready Setup"}
            </Link>
          </div>
        </div>

        <img
          alt="Healthcare administrator reviewing compliance checklist and records"
          className="marketing-image"
          src="https://images.pexels.com/photos/7089401/pexels-photo-7089401.jpeg?auto=compress&cs=tinysrgb&w=1200"
        />
      </section>

      <section className="marketing-grid two-column">
        <article className="feature-card">
          <h3>Policy-Based Access</h3>
          <p>
            Standardize who can view and update records to align with hospital policies and minimize
            data handling risks.
          </p>
        </article>
        <article className="feature-card">
          <h3>Operational Traceability</h3>
          <p>
            Keep a clear record of key actions, reducing manual reconciliation during internal and
            external reviews.
          </p>
        </article>
        <article className="feature-card">
          <h3>Data Quality Controls</h3>
          <p>
            Improve consistency in patient documentation with role-specific forms and structured record
            workflows.
          </p>
        </article>
        <article className="feature-card">
          <h3>Prepared Reporting</h3>
          <p>
            Support leadership and compliance teams with accurate operational snapshots from one trusted
            system.
          </p>
        </article>
      </section>

      <PublicFooter />
    </main>
  );
}
