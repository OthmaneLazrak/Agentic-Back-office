import React, { useEffect, useState } from "react";
import { GLOBAL_CSS } from "./styles/globalCss.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/TopBar.jsx";
import DashboardPage from "./pages/Dashboardpage.jsx";
import KYCPage from "./pages/KYCPage.jsx";
import BackOfficePage from "./pages/BackOfficePage.jsx";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { ROLES, ROLE_LABEL, AWB } from "./constants/Theme.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import api from "./auth/apiClient.js";

const PAGE_META = {
  dashboard:  { title: "Dashboard",         subtitle: "Vue d'ensemble des opérations" },
  kyc:        { title: "Front Office KYC",  subtitle: "Saisie, analyse et première décision" },
  backoffice: { title: "Back Office KYC",   subtitle: "Traitement manuel des dossiers escaladés" },
  admin:      { title: "Gestion utilisateurs", subtitle: "Création et administration des comptes" },
};

const DEFAULT_PAGE_BY_ROLE = {
  [ROLES.ADMIN]: "admin",
  [ROLES.FRONT_OFFICE]: "kyc",
  [ROLES.BACK_OFFICE]: "backoffice",
};

const ALLOWED_PAGES_BY_ROLE = {
  [ROLES.ADMIN]: ["dashboard", "admin"],
  [ROLES.FRONT_OFFICE]: ["dashboard", "kyc"],
  [ROLES.BACK_OFFICE]: ["dashboard", "backoffice"],
};

function LoadingScreen({ label = "Chargement…" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: AWB.slate50, color: AWB.navy,
      fontFamily: "Inter, Roboto, sans-serif", fontSize: 14,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 36, height: 36, border: `3px solid ${AWB.slate200}`,
          borderTopColor: AWB.navy, borderRadius: "50%",
          animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
        }} />
        {label}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function App() {
  const { initialized, authenticated, profile } = useAuth();
  const userRole = profile?.primaryRole || ROLES.FRONT_OFFICE;
  const fullName = profile?.fullName || profile?.username || "Utilisateur";

  const [activePage, setActivePage] = useState("dashboard");
  const [backendProfile, setBackendProfile] = useState(null);

  useEffect(() => {
    if (!authenticated || !profile) return;
    const allowed = ALLOWED_PAGES_BY_ROLE[userRole] || ["dashboard"];
    const stored = localStorage.getItem("awb.activePage");
    const initial = stored && allowed.includes(stored) ? stored : (DEFAULT_PAGE_BY_ROLE[userRole] || "dashboard");
    setActivePage(initial);
  }, [authenticated, profile, userRole]);

  useEffect(() => {
    if (!authenticated) return;
    api.get("/api/auth/me")
      .then((res) => setBackendProfile(res.data))
      .catch((err) => console.error("Failed to sync /api/auth/me", err));
  }, [authenticated]);

  useEffect(() => {
    localStorage.setItem("awb.activePage", activePage);
  }, [activePage]);

  if (!initialized) return <LoadingScreen label="Initialisation de la session…" />;
  if (!authenticated) return <LoginPage />;

  const meta = PAGE_META[activePage] || PAGE_META.dashboard;
  const allowedPages = ALLOWED_PAGES_BY_ROLE[userRole] || ["dashboard"];
  const selectedUser = backendProfile
    ? { id: backendProfile.id, fullName: backendProfile.fullName, type: backendProfile.role }
    : { id: null, fullName, type: userRole };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="layout">
        <Sidebar
          activePage={activePage}
          setActivePage={(p) => allowedPages.includes(p) && setActivePage(p)}
          userRole={userRole}
          fullName={fullName}
        />

        <div className="main">
          <Topbar
            pageTitle={meta.title}
            pageSubtitle={meta.subtitle}
            userRole={userRole}
            roleLabel={ROLE_LABEL[userRole] || "Utilisateur"}
            fullName={fullName}
          />
          <div className="content">
            {activePage === "dashboard" && (
              <ProtectedRoute roles={[ROLES.ADMIN, ROLES.FRONT_OFFICE, ROLES.BACK_OFFICE]}>
                <DashboardPage />
              </ProtectedRoute>
            )}
            {activePage === "kyc" && (
              <ProtectedRoute roles={[ROLES.FRONT_OFFICE]}>
                <KYCPage userRole={userRole} selectedUser={selectedUser} />
              </ProtectedRoute>
            )}
            {activePage === "backoffice" && (
              <ProtectedRoute roles={[ROLES.BACK_OFFICE]}>
                <BackOfficePage selectedUser={selectedUser} />
              </ProtectedRoute>
            )}
            {activePage === "admin" && (
              <ProtectedRoute roles={[ROLES.ADMIN]}>
                <AdminUsersPage />
              </ProtectedRoute>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
