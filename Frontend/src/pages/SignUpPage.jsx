import { Navigate, useNavigate } from "react-router-dom";
import AuthForm from "../components/auth/AuthForm";
import { getRoleOptions, registerUser } from "../services/ehrService";

export default function SignUpPage({ user }) {
  const navigate = useNavigate();
  const roles = getRoleOptions();

  if (user) {
    return <Navigate replace to="/portal" />;
  }

  async function handleSignUp(form) {
    const result = await registerUser(form);
    if (!result.ok) {
      return result;
    }
    navigate("/signin", {
      replace: true,
      state: { notice: "Signup request submitted. Wait for administrator approval before signing in." }
    });
    return { ok: true };
  }

  return (
    <main className="page-shell signup-page">
      <AuthForm mode="signup" onSubmit={handleSignUp} roles={roles} />
    </main>
  );
}
