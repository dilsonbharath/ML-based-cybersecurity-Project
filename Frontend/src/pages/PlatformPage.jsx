import { Link } from "react-router-dom";
import PublicFooter from "../components/layout/PublicFooter";

export default function PlatformPage({ user }) {
  return (
    <main className="page-shell">
      <section className="marketing-hero">
        <div>
          <p className="eyebrow">Platform Overview</p>
          <h1>Connected workflows for every clinical role</h1>
          <p>
            From front-desk teams to clinicians, the platform keeps appointments, records, and
            treatment updates synchronized in one trusted source of truth.
          </p>
          <div className="actions">
            <Link className="btn primary" to={user ? "/portal" : "/signup"}>
              {user ? "Open Portal" : "Start With Sign Up"}
            </Link>
            {!user && (
              <Link className="btn subtle" to="/signin">
                Sign In
              </Link>
            )}
          </div>
        </div>

        <img
          alt="Healthcare professionals reviewing data on a hospital dashboard"
          className="marketing-image"
          src="https://images.pexels.com/photos/7580254/pexels-photo-7580254.jpeg?auto=compress&cs=tinysrgb&w=1200"
        />
      </section>

      <section className="marketing-grid">
        <article className="feature-card">
          <h3>Smart Appointment Streams</h3>
          <p>
            Track visit status, assign priorities, and ensure each provider has clear, timely patient
            context before consultation begins.
          </p>
        </article>
        <article className="feature-card">
          <h3>Unified Clinical Timeline</h3>
          <p>
            Surface previous diagnoses, prescribed medication, and follow-up requirements without
            switching tools or duplicating records.
          </p>
        </article>
        <article className="feature-card">
          <h3>Cross-Team Coordination</h3>
          <p>
            Enable doctors, nurses, and admin staff to update workflows together while preserving role
            boundaries and accountability.
          </p>
        </article>
      </section>

      <PublicFooter />
    </main>
  );
}
