import React from "react";
import { useAuth } from "./AuthContext.jsx";
import { AWB } from "../constants/Theme.jsx";

export default function ProtectedRoute({ roles, children, fallback = null }) {
  const { authenticated, profile } = useAuth();

  if (!authenticated || !profile) {
    return fallback;
  }

  if (roles && roles.length > 0) {
    const ok = roles.some((r) => profile.roles?.includes(r));
    if (!ok) {
      return (
        <div style={{ padding: 24 }}>
          <div style={{
            background: AWB.dangerSoft,
            color: AWB.danger,
            border: `1px solid ${AWB.danger}`,
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            fontWeight: 600,
          }}>
            Accès refusé — votre rôle ne vous donne pas accès à cette section.
          </div>
        </div>
      );
    }
  }

  return children;
}
