import React from "react";
import { ROLE_LABEL, ROLES } from "../constants/Theme.jsx";
import logo from "../assets/logo_awb.jpg";

const NAV_MAIN = [
  { id: "dashboard",  icon: "▦", label: "Dashboard" },
  { id: "kyc",        icon: "◈", label: "Vérification KYC", roles: [ROLES.FRONT_OFFICE] },
  { id: "backoffice", icon: "▣", label: "Back Office",  roles: [ROLES.BACK_OFFICE] },
  { id: "admin",      icon: "✪", label: "Administration", roles: [ROLES.ADMIN] },
];

function initialsOf(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";
}

export default function Sidebar({ activePage, setActivePage, userRole = ROLES.FRONT_OFFICE, fullName = "Utilisateur" }) {
  const visibleNav = NAV_MAIN.filter((item) => !item.roles || item.roles.includes(userRole));
  const roleLabel = ROLE_LABEL[userRole] || "Utilisateur";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="Attijariwafa Bank" className="sidebar-logo-img" />
        <div>
          <div className="sidebar-brand">Attijariwafa Bank</div>
          <div className="sidebar-tagline">Together Everywhere</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Main Menu</div>
        {visibleNav.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? "active" : ""}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </div>
        ))}
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">{initialsOf(fullName)}</div>
        <div>
          <div className="user-name">{fullName}</div>
          <div className="user-role">{roleLabel}</div>
        </div>
      </div>
    </aside>
  );
}
