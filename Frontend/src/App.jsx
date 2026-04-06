import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/layout/NavBar";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import CompliancePage from "./pages/CompliancePage";
import ContactPage from "./pages/ContactPage";
import LandingPage from "./pages/LandingPage";
import PortalPage from "./pages/PortalPage";
import PlatformPage from "./pages/PlatformPage";
import SecurityPage from "./pages/SecurityPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import { getSessionUser, logoutUser } from "./services/ehrService";

export default function App() {
  const [user, setUser] = useState(() => getSessionUser());

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }

    window.addEventListener("ehr:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("ehr:unauthorized", handleUnauthorized);
    };
  }, []);

  function handleLogout() {
    setUser(null);
    void logoutUser();
  }

  return (
    <div className="app-root">
      <NavBar onLogout={handleLogout} user={user} />
      <Routes>
        <Route element={<LandingPage user={user} />} path="/" />
        <Route element={<PlatformPage user={user} />} path="/platform" />
        <Route element={<SecurityPage user={user} />} path="/security" />
        <Route element={<CompliancePage user={user} />} path="/compliance" />
        <Route element={<ContactPage user={user} />} path="/contact" />
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
