import React, { useState, useEffect } from "react";
import { GLOBAL_CSS } from "./styles/globalCss.jsx";
import Sidebar        from "./components/Sidebar.jsx";
import Topbar         from "./components/TopBar.jsx";
import DashboardPage  from "./pages/Dashboardpage.jsx";
import KYCPage        from "./pages/KYCPage.jsx";
import BackOfficePage from "./pages/BackOfficePage.jsx";
import { API_BASE } from "./constants/Theme.jsx";

const PAGE_META = {
  dashboard:  { title: "Dashboard",        subtitle: "Vue d'ensemble des opérations" },
  kyc:        { title: "Front Office KYC",  subtitle: "Saisie, analyse et première décision" },
  backoffice: { title: "Back Office KYC",   subtitle: "Traitement manuel des dossiers escaladés" },
};

export default function App() {
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem("awb.activePage") || "kyc";
  });
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem("awb.userRole") || "FRONT_OFFICE";
  });
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    localStorage.setItem("awb.activePage", activePage);
  }, [activePage]);

  useEffect(() => {
    localStorage.setItem("awb.userRole", userRole);
    if (userRole === "BACK_OFFICE" && activePage === "kyc") setActivePage("backoffice");
    if (userRole === "FRONT_OFFICE" && activePage === "backoffice") setActivePage("kyc");
  }, [userRole, activePage]);

  useEffect(() => {
    fetch(`${API_BASE}/users`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("users")))
      .then((data) => {
        setUsers(data);
        const savedId = Number(localStorage.getItem("awb.userId"));
        const saved = data.find((u) => u.id === savedId);
        const fallback = saved || data.find((u) => u.type === userRole) || data[0] || null;
        if (fallback) {
          setSelectedUser(fallback);
          setUserRole(fallback.type);
        }
      })
      .catch(() => {
        const fallback = { id: null, fullName: "Othmane Lazrek", type: userRole };
        setSelectedUser(fallback);
      });
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserRole(user.type);
    if (user.id != null) localStorage.setItem("awb.userId", String(user.id));
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="layout">
        <Sidebar activePage={activePage} setActivePage={setActivePage} userRole={userRole} />

        <div className="main">
          <Topbar
            pageTitle={(PAGE_META[activePage] || {}).title || ""}
            pageSubtitle={(PAGE_META[activePage] || {}).subtitle || ""}
            userRole={userRole}
            users={users}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
          />
          <div className="content">

            <div style={{ display: activePage === "kyc" ? "block" : "none" }}>
              <KYCPage userRole={userRole} selectedUser={selectedUser} />
            </div>

            <div style={{ display: activePage === "dashboard" ? "block" : "none" }}>
              <DashboardPage />
            </div>

            <div style={{ display: activePage === "backoffice" ? "block" : "none" }}>
              <BackOfficePage selectedUser={selectedUser} />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
