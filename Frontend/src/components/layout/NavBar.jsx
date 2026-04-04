import { Link } from "react-router-dom";

export default function NavBar({ user, onLogout }) {
  return (
    <header className="top-nav">
      <Link className="brand" to="/">
        Kranium HMIS
      </Link>
      <nav className="menu">
        {!user && (
          <>
            <Link to="/signin">Sign In</Link>
            <Link className="menu-cta" to="/signup">
              Sign Up
            </Link>
          </>
        )}
        {user && (
          <>
            <Link to="/portal">Portal</Link>
            <button onClick={onLogout} type="button">
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
