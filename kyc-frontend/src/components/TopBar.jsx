import React, { useState, useEffect, useRef } from "react";
import { AWB, ROLES } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";
import { useAuth } from "../auth/AuthContext.jsx";

// ─────────────────────── Inline icons ───────────────────────
const Icon = ({ children, size = 16, color = "currentColor", style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
       style={style} aria-hidden="true">
    {children}
  </svg>
);
const IconBell      = (p) => <Icon {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>;
const IconChevDown  = (p) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>;
const IconLogOut    = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
const IconUser      = (p) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

function initialsOf(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";
}

function NotificationsMenu({ onClose, notifications = [] }) {
  const ref = useRef();
  useClickOutside(ref, onClose);
  return (
    <div className="tb-popover" ref={ref} role="menu">
      <div className="tb-popover-head">
        <div style={{ fontWeight: 600, fontSize: 13, color: AWB.navy }}>Notifications</div>
        <button className="tb-popover-action">Tout marquer lu</button>
      </div>
      <div className="tb-popover-list">
        {notifications.length === 0 && (
          <div className="tb-notif">
            <span className="tb-notif-dot info" />
            <div className="tb-notif-title">Aucun dossier escaladé</div>
          </div>
        )}
        {notifications.map((n) => (
          <div key={n.id} className="tb-notif unread">
            <span className="tb-notif-dot warning" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tb-notif-title">{n.title}</div>
              <div className="tb-notif-meta">{n.motif}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserMenu({ onClose, roleLabel, fullName, email, onLogout, onAccount }) {
  const ref = useRef();
  useClickOutside(ref, onClose);

  return (
    <div className="tb-popover user" ref={ref} role="menu">
      <div className="tb-user-head">
        <div className="tb-user-head-avatar">{initialsOf(fullName)}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: AWB.navy }}>{fullName || "Utilisateur"}</div>
          <div style={{ fontSize: 11, color: AWB.slate500, marginTop: 1 }}>{roleLabel}</div>
          {email && <div style={{ fontSize: 11, color: AWB.slate400, marginTop: 2 }}>{email}</div>}
        </div>
      </div>
      <div className="tb-user-items">
        <button className="tb-user-item" onClick={onAccount}>
          <IconUser size={14} color={AWB.slate600} />
          Mon compte Keycloak
        </button>
      </div>
      <div className="tb-user-foot">
        <button className="tb-user-item danger" onClick={onLogout}>
          <IconLogOut size={14} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

export default function Topbar({ pageTitle = "Back-Office", pageSubtitle = "", userRole = ROLES.FRONT_OFFICE, roleLabel = "Utilisateur", fullName = "Utilisateur" }) {
  const { profile, logout, accountManagement } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const unread = notifications.length;
  const toggle = (k) => setOpenMenu((cur) => (cur === k ? null : k));

  useEffect(() => {
    if (userRole !== ROLES.BACK_OFFICE) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const res = await api.get(`/kyc/dashboard?range=14`);
        if (!cancelled) setNotifications(res.data.notifications || []);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    };
    loadNotifications();
    const timer = setInterval(loadNotifications, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userRole]);

  return (
    <div className="topbar">
      <div className="tb-title-block">
        <div className="tb-title">{pageTitle}</div>
        {pageSubtitle && <div className="tb-subtitle">{pageSubtitle}</div>}
      </div>

      <div className="tb-right">
        {userRole === ROLES.BACK_OFFICE && (
          <div className="tb-menu-wrap">
            <button
              className={`tb-icon-btn ${openMenu === "notif" ? "active" : ""}`}
              onClick={() => toggle("notif")}
              aria-label="Notifications Back Office"
            >
              <IconBell size={16} />
              {unread > 0 && <span className="tb-badge">{unread}</span>}
            </button>
            {openMenu === "notif" && (
              <NotificationsMenu
                onClose={() => setOpenMenu(null)}
                notifications={notifications}
              />
            )}
          </div>
        )}

        <div className="tb-menu-wrap">
          <button
            className={`tb-user-trigger ${openMenu === "user" ? "active" : ""}`}
            onClick={() => toggle("user")}
            aria-label="Profil utilisateur"
          >
            <div className="topbar-avatar">{initialsOf(fullName)}</div>
            <div className="tb-user-text">
              <div className="topbar-username">{fullName}</div>
              <div className="topbar-role">{roleLabel}</div>
            </div>
            <IconChevDown size={12} color={AWB.slate500} />
          </button>
          {openMenu === "user" && (
            <UserMenu
              onClose={() => setOpenMenu(null)}
              roleLabel={roleLabel}
              fullName={fullName}
              email={profile?.email}
              onLogout={() => { setOpenMenu(null); logout(); }}
              onAccount={() => { setOpenMenu(null); accountManagement(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
