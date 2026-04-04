import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthForm({ mode, roles, noticeText, onSubmit }) {
  const navigate = useNavigate();
  const isSignUp = mode === "signup";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Doctor"
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(noticeText || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotice(noticeText || "");
  }, [noticeText]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    const result = await onSubmit(form);
    setLoading(false);

    if (!result?.ok) {
      setError(result?.error || "Unable to continue.");
      return;
    }

    setError("");
    if (result.notice) {
      setNotice(result.notice);
    }
  }

  return (
    <section className="auth-wrapper">
      <article className="auth-card">
        <h2>{isSignUp ? "Create Account" : "Sign In"}</h2>
        <form className="form-grid" onSubmit={submit}>
          {isSignUp && (
            <label>
              Full Name
              <input
                name="name"
                onChange={updateField}
                placeholder="Enter full name"
                required
                type="text"
                value={form.name}
              />
            </label>
          )}

          <label>
            Email
            <input
              name="email"
              onChange={updateField}
              placeholder="name@hospital.org"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label>
            Password
            <input
              minLength={6}
              name="password"
              onChange={updateField}
              placeholder="Minimum 6 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          {isSignUp && (
            <label>
              Role
              <select name="role" onChange={updateField} value={form.role}>
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
          )}

          {notice && <p className="notice">{notice}</p>}
          {error && <p className="error">{error}</p>}

          <button className="btn primary full" disabled={loading} type="submit">
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="swap">
          {isSignUp ? "Already registered?" : "Need an account?"}{" "}
          <button
            className="linklike"
            onClick={() => navigate(isSignUp ? "/signin" : "/signup")}
            type="button"
          >
            {isSignUp ? "Go to Sign In" : "Go to Sign Up"}
          </button>
        </p>
      </article>
    </section>
  );
}
