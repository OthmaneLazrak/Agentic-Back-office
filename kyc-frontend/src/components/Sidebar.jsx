import React from "react";
import { AWB } from "../constants/Theme.jsx";
import logo from '../assets/logo_awb.jpg';


const NAV_MAIN = [
  { id: "dashboard",  icon: "▦", label: "Dashboard" },
  { id: "kyc",        icon: "◈", label: "KYC Verification" },
];


export default function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
          <div className="sidebar-logo">
    <img
      src={logo}
      alt="Attijariwafa Bank"
      className="sidebar-logo-img"
    />
    <div>
      <div className="sidebar-brand">Attijariwafa Bank</div>
      <div className="sidebar-tagline">Together Everywhere</div>
    </div>
  </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Main Menu</div>
        {NAV_MAIN.map((item) => (
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
        <div className="user-avatar">OL</div>
        <div>
          <div className="user-name">Othmane Lazrek</div>
        </div>
      </div>
    </aside>
  );
}