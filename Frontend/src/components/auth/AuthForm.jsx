import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthForm({ mode, roles, noticeText, onSubmit }) {
  const navigate = useNavigate();
  const isSignUp = mode === "signup";
  const passwordPolicy = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  const [form, setForm] = useState({
    name: "",
    age: "",
    username: "",
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
    setForm((previous) => ({
      ...previous,
      [name]: name === "username" ? value.toLowerCase() : value
    }));
  }

  function buildRoleAlias(role) {
    return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  const usernameAlias = form.username.trim().replace(/[^a-z0-9._]/g, "");
  const generatedIdentity =
    usernameAlias && form.role
      ? `${usernameAlias}.${buildRoleAlias(form.role)}@ehr.in`
      : "username.role@ehr.in";

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (isSignUp) {
      if (!form.name.trim()) {
        setError("Name is required.");
        return;
      }

      const ageValue = Number(form.age);
      if (!Number.isInteger(ageValue) || ageValue < 18 || ageValue > 100) {
        setError("Age must be an integer between 18 and 100.");
        return;
      }

      if (!/^[a-z0-9._]+$/.test(usernameAlias)) {
        setError("Username can only use lowercase letters, numbers, dot, or underscore.");
        return;
      }

      if (!passwordPolicy.test(form.password)) {
        setError(
          "Password must be 12+ characters with at least 1 uppercase letter, 1 number, and 1 special character."
        );
        return;
      }
    }

    setLoading(true);
    const result = await onSubmit(
      isSignUp
        ? {
            ...form,
            age: Number(form.age),
            username: usernameAlias,
            email: generatedIdentity
          }
        : form
    );
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
      <div className={`auth-layout ${isSignUp ? "signup-layout" : "signin-layout"}`}>
        <aside className="auth-context-panel">
          <p className="eyebrow">Secure Access</p>
          <h3>{isSignUp ? "Set up your hospital account" : "Welcome back to your care workspace"}</h3>
          <p>
            {isSignUp
              ? "Register once to access appointment management, patient records, and role-specific tools."
              : "Sign in to continue with appointments, clinical records, and patient operations."}
          </p>
          <ul>
            <li>Protected session authentication</li>
            <li>Role-based dashboard experience</li>
            <li>Fast access to live patient workflows</li>
          </ul>
        </aside>

        <article className="auth-card">
          <h2>{isSignUp ? "Create Account" : "Sign In"}</h2>
          <p className="auth-subtitle">
            {isSignUp
              ? "Provide your details to generate your EHR username and account role."
              : "Enter your EHR username and password to continue."}
          </p>

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

            {isSignUp && (
              <label>
                Age
                <input
                  max={100}
                  min={18}
                  name="age"
                  onChange={updateField}
                  placeholder="Enter age"
                  required
                  type="number"
                  value={form.age}
                />
              </label>
            )}

            {isSignUp && (
              <label>
                Username
                <input
                  name="username"
                  onChange={updateField}
                  placeholder="e.g. ramesh.k"
                  required
                  type="text"
                  value={form.username}
                />
              </label>
            )}

            <label>
              {isSignUp ? "EHR Username" : "EHR Username"}
              <input
                name="email"
                onChange={updateField}
                placeholder="username.role@ehr.in"
                required
                type="email"
                value={isSignUp ? generatedIdentity : form.email}
                readOnly={isSignUp}
              />
            </label>

            <label>
              Password
              <input
                minLength={isSignUp ? 12 : 6}
                name="password"
                onChange={updateField}
                placeholder={
                  isSignUp
                    ? "Min 12 chars, 1 caps, 1 number, 1 special"
                    : "Enter your account password"
                }
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
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
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
      </div>
    </section>
  );
}
