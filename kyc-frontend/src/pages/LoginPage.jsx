import React, { useState, useRef, useEffect } from "react";
import { AWB } from "../constants/Theme.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import logo from "../assets/logo_awb.jpg";
import bgImage from "../assets/att.png";


const LOGIN_CSS = `
  .login-root {
    position: relative;
    min-height: 100vh;
    height: 100vh;
    width: 100%;
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: ${AWB.navy};
  }

  /* ─────────────── Full-screen background photo ───────────────
     object-fit: cover → l'image remplit toute la surface, sans
     marges latérales. Le ratio est conservé (pas de déformation) ;
     un léger crop haut/bas peut survenir si le ratio image ≠ écran. */
  .login-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: 0;
  }
  /* Navy gradient overlay — darkens the photo so the white card always
     pops, and keeps the brand identity even if the image is light. */
  .login-bg-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(115deg,
        rgba(13,27,42,0.78) 0%,
        rgba(13,27,42,0.55) 45%,
        rgba(13,27,42,0.35) 100%);
    pointer-events: none;
  }

  /* ─────────────── Floating login card (right side) ─────────────── */
  .login-stage {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8vw 0 4vw;
  }
  /* Glassmorphism — la carte est quasi transparente, le backdrop-filter
     floute uniquement ce qui se trouve DERRIÈRE elle (la photo en
     background). saturate(180%) compense la perte de saturation due
     au flou et garde les couleurs vivantes. */
  .login-card {
    width: 100%;
    max-width: 420px;
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.28);
    border-radius: 14px;
    padding: 36px 36px 32px;
    box-shadow:
      0 30px 60px rgba(0,0,0,0.45),
      0 12px 24px rgba(0,0,0,0.25),
      inset 0 1px 0 rgba(255,255,255,0.40);
  }

  /* Brand chip — top of the card */
  .login-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 22px;
    margin-bottom: 24px;
    border-bottom: 1px solid ${AWB.slate200};
  }
  .login-brand-mark {
    width: 38px; height: 38px;
    border-radius: 8px;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    padding: 0;
    flex-shrink: 0;
  }
  .login-brand-mark img {
    width: 100%; height: 100%; object-fit: contain; display: block;
  }
  .login-brand-name {
    font-size: 16px;
    font-weight: 700;
    color: ${AWB.navy};
    letter-spacing: -0.015em;
    line-height: 1.1;
  }
  .login-brand-tag {
    font-size: 11px;
    color: ${AWB.slate700};
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 3px;
  }

  .login-title {
    font-size: 28px;
    font-weight: 600;
    color: ${AWB.navy};
    letter-spacing: -0.025em;
    margin-bottom: 6px;
  }
  .login-sub {
    font-size: 13px;
    color: ${AWB.slate700};
    line-height: 1.55;
    margin-bottom: 24px;
  }

  .login-error {
    display: flex; align-items: flex-start; gap: 10px;
    background: ${AWB.dangerSoft};
    border: 1px solid #FECACA;
    border-radius: 8px;
    padding: 10px 12px; margin-bottom: 16px;
    font-size: 12.5px; color: ${AWB.danger};
    line-height: 1.5;
    animation: loginShake 0.3s ease-out;
  }
  .login-error svg { flex-shrink: 0; margin-top: 1px; }
  @keyframes loginShake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }

  .login-field {
    display: flex; flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .login-label {
    font-size: 11.5px;
    font-weight: 500;
    color: ${AWB.slate700};
  }
  .login-input-wrap {
    position: relative;
    display: flex; align-items: center;
  }
  .login-input {
    flex: 1; width: 100%;
    border: 1px solid ${AWB.slate200};
    background: ${AWB.white};
    border-radius: 6px;
    padding: 11px 13px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    color: ${AWB.navy};
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
    outline: none;
  }
  .login-input.with-toggle { padding-right: 42px; }
  .login-input::placeholder { color: ${AWB.slate400}; }
  .login-input:hover { border-color: ${AWB.slate300}; }
  .login-input:focus {
    border-color: ${AWB.gold};
    box-shadow: 0 0 0 3px rgba(245,168,0,0.22);
  }
  .login-input[aria-invalid="true"] {
    border-color: ${AWB.danger};
    box-shadow: 0 0 0 3px rgba(185,28,28,0.12);
  }
  .login-input:disabled {
    background: ${AWB.slate50};
    color: ${AWB.slate400};
    cursor: not-allowed;
  }
  .login-toggle {
    position: absolute;
    right: 5px;
    top: 50%; transform: translateY(-50%);
    width: 32px; height: 32px;
    background: transparent; border: none;
    border-radius: 6px;
    cursor: pointer;
    color: ${AWB.slate400};
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .login-toggle:hover { color: ${AWB.navy}; background: ${AWB.slate50}; }
  .login-toggle:focus-visible {
    outline: 2px solid ${AWB.gold};
    outline-offset: 1px;
  }

  .login-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 22px;
    font-size: 12.5px;
  }
  .login-check {
    display: inline-flex; align-items: center; gap: 8px;
    cursor: pointer;
    color: ${AWB.slate700};
    user-select: none;
  }
  .login-check input { position: absolute; opacity: 0; pointer-events: none; }
  .login-check-box {
    width: 16px; height: 16px;
    border: 1.5px solid ${AWB.slate300};
    border-radius: 4px;
    background: ${AWB.white};
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .login-check:hover .login-check-box { border-color: ${AWB.slate400}; }
  .login-check input:checked + .login-check-box {
    background: ${AWB.gold};
    border-color: ${AWB.gold};
  }
  .login-check input:focus-visible + .login-check-box {
    outline: 2px solid ${AWB.gold};
    outline-offset: 2px;
  }
  .login-check-box svg {
    opacity: 0;
    color: ${AWB.navy};
    transition: opacity 0.15s ease;
  }
  .login-check input:checked + .login-check-box svg { opacity: 1; }

  .login-forgot {
    background: none; border: none;
    color: ${AWB.navy};
    font-size: 12.5px; font-weight: 500;
    cursor: pointer;
    padding: 4px 2px;
    font-family: 'Inter', sans-serif;
    transition: color 0.15s ease;
    border-radius: 4px;
  }
  .login-forgot:hover { color: ${AWB.goldDark}; text-decoration: underline; }

  .login-submit {
    width: 100%;
    background: ${AWB.gold};
    color: ${AWB.navy};
    border: none;
    border-radius: 6px;
    padding: 13px 20px;
    font-family: 'Inter', sans-serif;
    font-size: 14.5px; font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 0.18s ease;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 6px 16px rgba(245,168,0,0.30);
  }
  .login-submit:hover:not(:disabled) {
    background: ${AWB.goldDark};
    box-shadow: 0 8px 22px rgba(201,136,0,0.40);
    transform: translateY(-1px);
  }
  .login-submit:active:not(:disabled) { transform: translateY(0); }
  .login-submit:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(13,27,42,0.30);
  }
  .login-submit:disabled {
    background: ${AWB.slate200};
    color: ${AWB.slate500};
    cursor: not-allowed;
    box-shadow: none;
  }
  .login-submit-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(13,27,42,0.30);
    border-top-color: ${AWB.navy};
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .login-foot-tls {
    margin-top: 20px;
    display: flex; align-items: center; gap: 8px;
    font-size: 11.5px; color: ${AWB.slate700};
    justify-content: center;
  }
  .login-foot-tls svg { color: ${AWB.success}; }

  /* ─────────────── Responsive ─────────────── */
  @media (max-width: 980px) {
    .login-stage { justify-content: center; padding: 24px; }
    .login-card { max-width: 440px; }
    .login-bg-overlay {
      background: linear-gradient(180deg,
        rgba(13,27,42,0.40) 0%,
        rgba(13,27,42,0.75) 100%);
    }
  }
  @media (max-width: 560px) {
    .login-card { padding: 26px 22px 22px; }
    .login-title { font-size: 24px; }
  }
`;

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ERROR_MESSAGES = {
  invalid_grant: "Identifiant ou mot de passe incorrect.",
  unauthorized: "Identifiant ou mot de passe incorrect.",
  invalid_request: "Veuillez renseigner tous les champs.",
  access_denied: "Accès refusé. Contactez votre administrateur.",
  network: "Service indisponible. Veuillez réessayer.",
};

export default function LoginPage() {
  const { loginWithPassword, login: ssoLogin } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const usernameRef = useRef(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!username.trim() || !password) {
      setError(ERROR_MESSAGES.invalid_request);
      return;
    }

    setSubmitting(true);
    try {
      await loginWithPassword(username.trim(), password, { remember });
    } catch (err) {
      const code = err?.code || err?.message || "unknown";
      setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.invalid_grant);
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{LOGIN_CSS}</style>
      <div className="login-root">
        {/* Full-screen background photo + tinted overlay */}
        <img src={bgImage} alt="" className="login-bg-img" aria-hidden="true" />
        <div className="login-bg-overlay" aria-hidden="true" />

        {/* Floating login card, right-aligned */}
        <div className="login-stage">
          <div className="login-card">
            <div className="login-brand">
              <div className="login-brand-mark">
                <img src={logo} alt="" />
              </div>
              <div>
                <div className="login-brand-name">Attijariwafa Bank</div>
                <div className="login-brand-tag">Back-Office</div>
              </div>
            </div>

            <h2 className="login-title">Connexion</h2>
            <p className="login-sub">
              Bienvenue. Veuillez entrer vos identifiants pour accéder à votre espace.
            </p>

            {error && (
              <div className="login-error" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="login-username">Username</label>
                <div className="login-input-wrap">
                  <input
                    id="login-username"
                    ref={usernameRef}
                    className="login-input"
                    type="text"
                    autoComplete="username"
                    placeholder="prenom.nom"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={submitting}
                    aria-invalid={!!error && !username.trim()}
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="login-password">Password</label>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    className="login-input with-toggle"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    aria-invalid={!!error && !password}
                  />
                  <button
                    type="button"
                    className="login-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div className="login-row">
                <label className="login-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={submitting}
                  />
                  <span className="login-check-box"><CheckIcon /></span>
                  Se souvenir de moi
                </label>
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => ssoLogin?.({ action: "UPDATE_PASSWORD" })}
                  disabled={submitting}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={submitting || !username.trim() || !password}
              >
                {submitting ? (
                  <>
                    <span className="login-submit-spinner" aria-hidden="true" />
                    Connexion en cours…
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowIcon />
                  </>
                )}
              </button>
            </form>

            <div className="login-foot-tls">
              <LockIcon />
              <span>Connexion chiffrée TLS · Audit conformité activé</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
