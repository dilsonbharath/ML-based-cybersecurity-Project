import { Link } from "react-router-dom";

export default function LandingPage({ user }) {
  return (
    <main className="page-shell">
      <section className="landing-card">
        <h1>Hospital Management Portal</h1>
        <p>Doctor appointments, today's patients, and full patient records in one place.</p>
        <div className="actions">
          {!user && (
            <>
              <Link className="btn primary" to="/signup">
                Sign Up
              </Link>
              <Link className="btn subtle" to="/signin">
                Sign In
              </Link>
            </>
          )}
          {user && (
            <Link className="btn primary" to="/portal">
              Open Portal
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
