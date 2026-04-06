import { Link } from "react-router-dom";
import PublicFooter from "../components/layout/PublicFooter";

export default function ContactPage({ user }) {
  return (
    <main className="page-shell">
      <section className="marketing-hero">
        <div>
          <p className="eyebrow">Talk to Our Team</p>
          <h1>Plan your secure healthcare digitization rollout</h1>
          <p>
            Connect with implementation specialists to map your clinical workflows, onboarding path,
            and support model for your organization.
          </p>
          <div className="actions">
            <Link className="btn primary" to={user ? "/portal" : "/signup"}>
              {user ? "Open Portal" : "Get Started"}
            </Link>
            {!user && (
              <Link className="btn subtle" to="/signin">
                Existing account sign in
              </Link>
            )}
          </div>
        </div>

        <img
          alt="Healthcare support team collaborating with clinicians"
          className="marketing-image"
          src="https://images.pexels.com/photos/7659564/pexels-photo-7659564.jpeg?auto=compress&cs=tinysrgb&w=1200"
        />
      </section>

      <section className="contact-grid">
        <article className="feature-card">
          <h3>Head Office</h3>
          <p>420 Medical District Drive, Boston, MA 02115</p>
        </article>
        <article className="feature-card">
          <h3>Email</h3>
          <p>healthsystems@ehrcare.org</p>
        </article>
        <article className="feature-card">
          <h3>Phone</h3>
          <p>+1 (555) 294-1870</p>
        </article>
        <article className="feature-card">
          <h3>Support Window</h3>
          <p>24/7 for clinical incidents and urgent operations</p>
        </article>
      </section>

      <PublicFooter />
    </main>
  );
}
