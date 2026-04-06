import { Link } from "react-router-dom";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "Platform", to: "/platform" },
  { label: "Security", to: "/security" },
  { label: "Compliance", to: "/compliance" },
  { label: "Contact", to: "/contact" }
];

export default function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <section>
          <h4>EHR Electronic Health Records</h4>
          <p>
            Healthcare operations platform for hospitals, clinics, and specialist teams managing
            patient journeys from intake to discharge.
          </p>
        </section>

        <section>
          <h5>Explore</h5>
          <nav className="footer-links" aria-label="Footer navigation">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
        </section>

        <section>
          <h5>Security</h5>
          <ul>
            <li>Role-based access controls</li>
            <li>Encrypted health record transport</li>
            <li>Audit-ready user activity history</li>
          </ul>
        </section>

        <section>
          <h5>Contact</h5>
          <p>healthsystems@ehrcare.org</p>
          <p>+1 (555) 294-1870</p>
          <p>24/7 support for clinical teams</p>
        </section>
      </div>

      <div className="site-footer-bottom">
        <span>2026 EHR Electronic Health Records</span>
        <span>Designed for secure healthcare operations</span>
      </div>
    </footer>
  );
}
