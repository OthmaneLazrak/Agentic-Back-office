import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import keycloak from "./keycloak.js";
import { KEYCLOAK_CONFIG, ROLES } from "../constants/Theme.jsx";

const BUSINESS_ROLES = [ROLES.ADMIN, ROLES.FRONT_OFFICE, ROLES.BACK_OFFICE];

const AuthContext = createContext(null);

// Guard against React StrictMode invoking effects twice in dev.
// keycloak.init() can only be called once per Keycloak instance.
let keycloakInitPromise = null;

function parseJwt(token) {
  if (!token) return {};
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function buildProfile(tokenParsed) {
  const realmRoles = (tokenParsed?.realm_access && tokenParsed.realm_access.roles) || [];
  return {
    id: tokenParsed?.sub,
    username: tokenParsed?.preferred_username,
    email: tokenParsed?.email,
    firstName: tokenParsed?.given_name,
    lastName: tokenParsed?.family_name,
    fullName: [tokenParsed?.given_name, tokenParsed?.family_name].filter(Boolean).join(" "),
    roles: realmRoles,
    primaryRole: BUSINESS_ROLES.find((r) => realmRoles.includes(r)) || null,
  };
}

// Per-user UI state buckets that must be wiped when the identity changes,
// otherwise the previous user's dossier (file preview, extracted fields,
// dossierId…) leaks into the next login.
const PER_USER_STORAGE_KEYS = ["awb.kyc.state.v1"];

function clearPerUserStorage() {
  for (const k of PER_USER_STORAGE_KEYS) {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  }
}

// Exchange a stored refresh_token for a fresh access_token. Returns the token
// payload on success, or null on failure (network, expired, revoked). Used at
// app boot to keep the user logged in across page refreshes — `check-sso`
// alone doesn't work because ROPC never set a Keycloak SSO cookie.
async function refreshFromStoredToken() {
  let storedRefresh = null;
  try { storedRefresh = localStorage.getItem("awb.refreshToken"); } catch { /* noop */ }
  if (!storedRefresh) return null;

  const url = `${KEYCLOAK_CONFIG.url}/realms/${encodeURIComponent(KEYCLOAK_CONFIG.realm)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: KEYCLOAK_CONFIG.clientId,
    refresh_token: storedRefresh,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      try { localStorage.removeItem("awb.refreshToken"); } catch { /* noop */ }
      return null;
    }
    const data = await res.json();
    try { localStorage.setItem("awb.refreshToken", data.refresh_token); } catch { /* noop */ }
    return data;
  } catch {
    return null;
  }
}

// Inject tokens obtained via ROPC into the keycloak-js instance so the rest
// of the app (apiClient interceptor, updateToken, etc.) keeps working unchanged.
function hydrateKeycloak(tokenResponse) {
  const now = Math.floor(Date.now() / 1000);
  const accessParsed = parseJwt(tokenResponse.access_token);
  const refreshParsed = parseJwt(tokenResponse.refresh_token);
  const idParsed = tokenResponse.id_token ? parseJwt(tokenResponse.id_token) : null;

  keycloak.token = tokenResponse.access_token;
  keycloak.refreshToken = tokenResponse.refresh_token;
  keycloak.idToken = tokenResponse.id_token || null;
  keycloak.tokenParsed = accessParsed;
  keycloak.refreshTokenParsed = refreshParsed;
  keycloak.idTokenParsed = idParsed;
  keycloak.authenticated = true;
  keycloak.subject = accessParsed.sub;
  keycloak.realmAccess = accessParsed.realm_access;
  keycloak.resourceAccess = accessParsed.resource_access;
  keycloak.sessionId = accessParsed.session_state || accessParsed.sid;
  keycloak.timeSkew = accessParsed.iat ? now - accessParsed.iat : 0;
}

export function AuthProvider({ children }) {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Try to revive the session from a previously stored ROPC refresh token.
      //    This is what keeps users logged in across F5 / browser restarts.
      const restored = await refreshFromStoredToken();
      if (cancelled) return;

      if (restored) {
        hydrateKeycloak(restored);
        setAuthenticated(true);
        setToken(restored.access_token);
        setProfile(buildProfile(keycloak.tokenParsed || {}));
        setInitialized(true);
        return;
      }

      // 2) Fallback: silent SSO check (works only if a Keycloak SSO cookie exists,
      //    e.g. after a redirect-based login). The React app shows <LoginPage />
      //    when this also returns false.
      if (!keycloakInitPromise) {
        keycloakInitPromise = keycloak.init({
          onLoad: "check-sso",
          pkceMethod: "S256",
          checkLoginIframe: false,
        });
      }
      keycloakInitPromise
        .then((isAuth) => {
          if (cancelled) return;
          setAuthenticated(isAuth);
          setToken(keycloak.token || null);
          if (isAuth) setProfile(buildProfile(keycloak.tokenParsed || {}));
          setInitialized(true);
        })
        .catch((err) => {
          console.error("Keycloak init failed", err);
          if (!cancelled) setInitialized(true);
        });
    })();

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) setToken(keycloak.token || null);
      }).catch(() => {
        // Refresh failed -> session is dead. Drop back to login screen.
        setAuthenticated(false);
        setProfile(null);
        setToken(null);
      });
    };

    keycloak.onAuthRefreshSuccess = () => setToken(keycloak.token || null);
    keycloak.onAuthLogout = () => {
      setAuthenticated(false);
      setProfile(null);
      setToken(null);
    };

    return () => { cancelled = true; };
  }, []);

  // ─── ROPC login (Direct Access Grant) ─────────────────────────────
  // The Keycloak client `kyc-frontend` must have "Direct Access Grants Enabled"
  // toggled ON in the realm's client configuration. Public client, no secret.
  const loginWithPassword = useCallback(async (username, password, { remember = true } = {}) => {
    // Wipe any previous user's dossier state up-front so a fresh login never
    // sees the previous user's uploaded images / extracted fields.
    clearPerUserStorage();

    const url = `${KEYCLOAK_CONFIG.url}/realms/${encodeURIComponent(KEYCLOAK_CONFIG.realm)}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: "password",
      client_id: KEYCLOAK_CONFIG.clientId,
      username,
      password,
      scope: "openid profile email",
    });

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (networkErr) {
      const err = new Error("Network error");
      err.code = "network";
      throw err;
    }

    if (!response.ok) {
      let payload = {};
      try { payload = await response.json(); } catch { /* noop */ }
      const code = payload.error || "invalid_grant";
      const error = new Error(payload.error_description || code);
      error.code = code;
      throw error;
    }

    const data = await response.json();
    hydrateKeycloak(data);

    if (remember) {
      try { localStorage.setItem("awb.refreshToken", data.refresh_token); } catch { /* noop */ }
    } else {
      try { localStorage.removeItem("awb.refreshToken"); } catch { /* noop */ }
    }

    setAuthenticated(true);
    setToken(data.access_token);
    setProfile(buildProfile(keycloak.tokenParsed || {}));
    return data;
  }, []);

  const value = useMemo(() => ({
    initialized,
    authenticated,
    token,
    profile,
    keycloak,
    hasRole: (role) => Boolean(profile?.roles?.includes(role)),
    hasAnyRole: (roles) => Array.isArray(roles) && roles.some((r) => profile?.roles?.includes(r)),
    login: (options) => keycloak.login(options),
    loginWithPassword,
    logout: async () => {
      // Manual logout: keycloak-js was never .init()'d (we bootstrap via ROPC
      // + refresh_token), so keycloak.logout() throws on undefined endpoints.
      // We POST directly to the end_session endpoint with the stored refresh
      // token, then wipe local state and bounce the user back to LoginPage.
      let storedRefresh = null;
      try { storedRefresh = localStorage.getItem("awb.refreshToken"); } catch { /* noop */ }

      if (storedRefresh) {
        const url = `${KEYCLOAK_CONFIG.url}/realms/${encodeURIComponent(KEYCLOAK_CONFIG.realm)}/protocol/openid-connect/logout`;
        const body = new URLSearchParams({
          client_id: KEYCLOAK_CONFIG.clientId,
          refresh_token: storedRefresh,
        });
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
        } catch { /* network failure shouldn't trap the user — clear locally anyway */ }
      }

      try { localStorage.removeItem("awb.refreshToken"); } catch { /* noop */ }
      clearPerUserStorage();

      // Reset in-memory keycloak instance so a later login starts clean.
      keycloak.token = null;
      keycloak.refreshToken = null;
      keycloak.idToken = null;
      keycloak.tokenParsed = null;
      keycloak.refreshTokenParsed = null;
      keycloak.idTokenParsed = null;
      keycloak.authenticated = false;

      setAuthenticated(false);
      setProfile(null);
      setToken(null);
    },
    accountManagement: () => keycloak.accountManagement(),
  }), [initialized, authenticated, token, profile, loginWithPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
