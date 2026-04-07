import { Link } from "react-router-dom";
import PublicFooter from "../components/layout/PublicFooter";

export default function LandingPage({ user }) {
  const slides = [
    {
      id: "transforming-health",
      eyebrow: "Transforming Health",
      title: "Transform hospital operations with secure digital workflows",
      description:
        "Bring appointments, records, and role-based actions into one reliable platform for faster and safer care delivery.",
      image:
        "https://images.pexels.com/photos/7580254/pexels-photo-7580254.jpeg?auto=compress&cs=tinysrgb&w=1400"
    },
    {
      id: "decision-insights",
      eyebrow: "Decision Support",
      title: "Meaningful insights for clinical and administrative decisions",
      description:
        "Use real-time visibility on patient flow and status updates to improve response times across departments.",
      image:
        "https://images.pexels.com/photos/7088530/pexels-photo-7088530.jpeg?auto=compress&cs=tinysrgb&w=1400"
    },
    {
      id: "enterprise-scale",
      eyebrow: "Enterprise Scale",
      title: "Built for multi-site hospitals and high daily patient volume",
      description:
        "Standardize workflows across locations while keeping teams aligned on a single, secure source of truth.",
      image:
        "https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg?auto=compress&cs=tinysrgb&w=1400"
    }
  ];

  return (
    <main className="landing-full-page">
      <div className="landing-full-stack">
        {slides.map((slide, index) => (
          <section className="landing-full-slide" key={slide.id}>
            <div className="landing-full-overlay">
              <p className="slide-kicker">
                {slide.eyebrow} - {index + 1}/{slides.length}
              </p>
              <h1>{slide.title}</h1>
              <p>{slide.description}</p>
              {index === 0 && (
                <div className="actions">
                  {!user && (
                    <>
                      <Link className="btn primary" to="/signup">
                        Create Staff Account
                      </Link>
                      <Link className="btn subtle" to="/signin">
                        Sign In
                      </Link>
                    </>
                  )}
                  {user && (
                    <Link className="btn primary" to="/portal">
                      Open Clinical Portal
                    </Link>
                  )}
                </div>
              )}
            </div>
            <img alt={slide.title} className="landing-full-image" src={slide.image} />
          </section>
        ))}
      </div>

      <section className="page-shell">
        <section className="landing-feature-showcase" aria-label="Platform highlights">
          <article className="landing-feature-card">
            <h3>Secure Authentication</h3>
            <p>
              New users sign up once, wait for administrator approval, then access role-specific tools with
              protected sessions.
            </p>
          </article>
          <article className="landing-feature-card">
            <h3>Faster OP Flow</h3>
            <p>
              Registration desk staff can create appointments quickly with shift-filtered doctor and nurse
              assignment.
            </p>
          </article>
          <article className="landing-feature-card">
            <h3>Clinical Visibility</h3>
            <p>
              Teams get a clear split between active patients and historical records while preserving care
              continuity.
            </p>
          </article>
        </section>
        <PublicFooter />
      </section>
    </main>
  );
}
