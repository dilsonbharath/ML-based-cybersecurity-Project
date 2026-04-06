import { Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthForm from "../components/auth/AuthForm";
import { loginUser } from "../services/ehrService";

export default function SignInPage({ user, onAuthSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (user) {
    return <Navigate replace to="/portal" />;
  }

  async function handleSignIn(form) {
    const result = await loginUser(form);
    if (!result.ok) {
      return result;
    }
    onAuthSuccess(result.user);
    navigate("/portal", { replace: true });
    return { ok: true };
  }

  return (
    <main className="page-shell">
      <AuthForm
        mode="signin"
        noticeText={location.state?.notice}
        onSubmit={handleSignIn}
        roles={[]}
      />
    </main>
  );
}
