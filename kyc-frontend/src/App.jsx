import React, { useState, useEffect } from "react";
import { GLOBAL_CSS } from "./styles/globalCss.jsx";
import Sidebar        from "./components/Sidebar.jsx";
import Topbar         from "./components/TopBar.jsx";
import DashboardPage  from "./pages/Dashboardpage.jsx";
import KYCPage        from "./pages/KYCPage.jsx";

const PAGE_META = {
  dashboard: { title: "Dashboard",        subtitle: "Vue d'ensemble des opérations" },
  kyc:       { title: "KYC Verification", subtitle: "Vérification d'identité client" },
};

export default function App() {
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem("awb.activePage") || "kyc";
  });

  useEffect(() => {
    localStorage.setItem("awb.activePage", activePage);
  }, [activePage]);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="layout">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />

        <div className="main">
          <Topbar
            pageTitle={(PAGE_META[activePage] || {}).title || ""}
            pageSubtitle={(PAGE_META[activePage] || {}).subtitle || ""}
          />
          <div className="content">

            <div style={{ display: activePage === "kyc" ? "block" : "none" }}>
              <KYCPage />
            </div>

            <div style={{ display: activePage === "dashboard" ? "block" : "none" }}>
              <DashboardPage />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
