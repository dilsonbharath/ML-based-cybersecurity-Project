import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/layout/NavBar";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import PortalPage from "./pages/PortalPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import { getSessionUser, logoutUser } from "./services/hmisService";

export default function App() {
  const [user, setUser] = useState(() => getSessionUser());

  async function handleLogout() {
    await logoutUser();
    setUser(null);
  }

  return (
    <div className="app-root">
      <NavBar onLogout={handleLogout} user={user} />
      <Routes>
        <Route element={<LandingPage user={user} />} path="/" />
        <Route element={<SignUpPage user={user} />} path="/signup" />
        <Route element={<SignInPage onAuthSuccess={setUser} user={user} />} path="/signin" />
        <Route
          element={
            <ProtectedRoute user={user}>
              <PortalPage user={user} />
            </ProtectedRoute>
          }
          path="/portal"
        />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </div>
  );
}
