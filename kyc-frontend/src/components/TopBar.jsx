import React, { useState, useEffect, useRef } from "react";
import { AWB, API_BASE } from "../constants/Theme.jsx";

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
const IconInbox     = (p) => <Icon {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Icon>;

// ─────────────────────── Environment (in real app, comes from env var / config) ───────────────────────
const ENVIRONMENT = { code: "REC", label: "Recette", kind: "test" };  // 'prod' | 'test' | 'dev'

// Mock — would come from a server query in real app
const PENDING_COUNT = 12;

// ─────────────────────── Hook: click outside ───────────────────────
function useClickOutside(ref, onClose) {
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

// ─────────────────────── Notifications ───────────────────────
const NOTIFICATIONS = [
  { id: 1, kind: "alert",   title: "Alerte AML · Dossier #8421",    meta: "il y a 2 min", unread: true  },
  { id: 2, kind: "success", title: "Dossier #8417 approuvé",        meta: "il y a 12 min", unread: true  },
  { id: 3, kind: "info",    title: "Nouveau dossier reçu · #8425",  meta: "il y a 28 min", unread: true  },
  { id: 4, kind: "warning", title: "CIN proche expiration · #8412", meta: "il y a 1 h",    unread: false },
];

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

// ─────────────────────── User menu ───────────────────────
function UserMenu({ onClose, userRole, users = [], selectedUser, onSelectUser }) {
  const ref = useRef();
  useClickOutside(ref, onClose);
  const roleLabel = userRole === "BACK_OFFICE" ? "Back Office" : "Front Office";

  const changeUser = (user) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="tb-popover user" ref={ref} role="menu">
      <div className="tb-user-head">
        <div className="tb-user-head-avatar">OL</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: AWB.navy }}>{selectedUser?.fullName || "Utilisateur"}</div>
          <div style={{ fontSize: 11, color: AWB.slate500, marginTop: 1 }}>{roleLabel}</div>
        </div>
      </div>
      <div className="tb-user-items">
        {users.map((user) => (
          <button
            key={user.id}
            className={`tb-user-item ${selectedUser?.id === user.id ? "selected" : ""}`}
            onClick={() => changeUser(user)}
          >
            {user.type === "BACK_OFFICE" ? <IconInbox size={14} color={AWB.slate600} /> : <IconUser size={14} color={AWB.slate600} />}
            {user.fullName} · {user.type === "BACK_OFFICE" ? "Back" : "Front"}
          </button>
        ))}
      </div>
      <div className="tb-user-foot">
        <button className="tb-user-item danger">
          <IconLogOut size={14} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

// ─────────────────────── Topbar ───────────────────────
export default function Topbar({ pageTitle = "Back-Office", pageSubtitle = "", userRole = "FRONT_OFFICE", users = [], selectedUser, onSelectUser = () => {} }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const unread = notifications.length;
  const toggle = (k) => setOpenMenu((cur) => (cur === k ? null : k));
  const roleLabel = userRole === "BACK_OFFICE" ? "Back Office" : "Front Office";

  useEffect(() => {
    if (userRole !== "BACK_OFFICE") {
      setNotifications([]);
      return;
    }

    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE}/kyc/dashboard?range=14`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNotifications(data.notifications || []);
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
      {/* Left: page title block */}
      <div className="tb-title-block">
        <div className="tb-title">{pageTitle}</div>
        {pageSubtitle && <div className="tb-subtitle">{pageSubtitle}</div>}
      </div>

      

      <div className="tb-right">
        {/* Pending dossiers — operational signal */}
        

        {userRole === "BACK_OFFICE" && (
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

        {/* User */}
        <div className="tb-menu-wrap">
          <button
            className={`tb-user-trigger ${openMenu === "user" ? "active" : ""}`}
            onClick={() => toggle("user")}
            aria-label="Profil utilisateur"
          >
            <div className="topbar-avatar">OL</div>
            <div className="tb-user-text">
              <div className="topbar-username">{selectedUser?.fullName || "Utilisateur"}</div>
              <div className="topbar-role">{roleLabel}</div>
            </div>
            <IconChevDown size={12} color={AWB.slate500} />
          </button>
          {openMenu === "user" && (
            <UserMenu
              onClose={() => setOpenMenu(null)}
              userRole={userRole}
              users={users}
              selectedUser={selectedUser}
              onSelectUser={onSelectUser}
            />
          )}
        </div>
      </div>
    </div>
  );
}
