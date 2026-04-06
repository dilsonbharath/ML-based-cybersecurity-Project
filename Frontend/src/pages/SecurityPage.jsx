import { Link } from "react-router-dom";
import PublicFooter from "../components/layout/PublicFooter";

export default function SecurityPage({ user }) {
  return (
    <main className="page-shell">
      <section className="marketing-hero">
        <div>
          <p className="eyebrow">Healthcare Security</p>
          <h1>Protecting patient records at every touchpoint</h1>
          <p>
            Security is built into every layer of the platform with strict role permissions, session
            controls, and reliable traceability for sensitive clinical activities.
          </p>
          <div className="actions">
            <Link className="btn primary" to={user ? "/portal" : "/signup"}>
              {user ? "Go to Portal" : "Create Secure Account"}
            </Link>
          </div>
        </div>

        <img
          alt="Cybersecurity lock concept for hospital patient data protection"
          className="marketing-image"
          src="https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=1200"
        />
      </section>

      <section className="security-panel">
        <article>
          <h3>Role-Based Access Control</h3>
          <p>Each team member sees only the patient operations and records required for their role.</p>
        </article>
        <article>
          <h3>End-to-End Encryption</h3>
          <p>Patient information is encrypted in transit and protected against unauthorized exposure.</p>
        </article>
        <article>
          <h3>Activity Audit Trails</h3>
          <p>Critical actions are traceable with timestamps for quality reviews and governance reporting.</p>
        </article>
      </section>

      <section className="marketing-photo-row">
        <img
          alt="Security operations professional monitoring encrypted healthcare systems"
          className="security-photo"
          src="https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=1200"
        />
        <img
          alt="Healthcare professional using secure tablet in a clinical environment"
          className="security-photo"
          src="https://images.pexels.com/photos/5726695/pexels-photo-5726695.jpeg?auto=compress&cs=tinysrgb&w=1200"
        />
      </section>

      <PublicFooter />
    </main>
  );
}
