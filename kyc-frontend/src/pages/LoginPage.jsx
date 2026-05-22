import React, { useState, useRef, useEffect } from "react";
import { AWB } from "../constants/Theme.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import logo from "../assets/logo_awb.jpg";


const LOGIN_CSS = `
  .login-root {
    display: grid;
    grid-template-columns: 55% 45%;
    min-height: 100vh;
    height: 100vh;
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: ${AWB.white};
  }

  .login-left {
    position: relative;
    background: linear-gradient(160deg, ${AWB.navy} 0%, ${AWB.navyDark} 100%);
    color: ${AWB.white};
    padding: 56px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    overflow: hidden;
  }

  .login-left::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 85% 15%, rgba(245,168,0,0.10) 0%, transparent 45%),
      radial-gradient(circle at 10% 90%, rgba(245,168,0,0.05) 0%, transparent 50%);
    pointer-events: none;
  }

  .login-left > * { position: relative; z-index: 1; }

  .login-logo {
    display: inline-flex; align-items: center; gap: 12px;
  }
  .login-logo-mark {
    width: 44px; height: 44px;
    border-radius: 10px;
    background: ${AWB.white};
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    padding: 4px;
    box-shadow:
      0 0 0 1px rgba(245,168,0,0.35),
      0 4px 10px rgba(0,0,0,0.18);
  }
  .login-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  /* Giant metallic "W" watermark in the background of the left panel —
     evokes the Attijariwafa Bank brand letter.
     Selector is .login-left > .login-bg-w (specificity 0,2,0) so it wins
     against the generic ".login-left > *" rule above. */
  .login-left > .login-bg-w {
    position: absolute;
    right: -60px;
    bottom: -90px;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 900;
    font-size: 520px;
    line-height: 0.85;
    letter-spacing: -0.05em;
    pointer-events: none;
    user-select: none;
    z-index: 0;

    /* Metallic gold gradient — same recipe as before, scaled up */
    background: linear-gradient(
      150deg,
      rgba(138,90,0,0.22)  0%,
      rgba(201,136,0,0.30) 18%,
      rgba(245,168,0,0.42) 38%,
      rgba(255,246,224,0.55) 50%,
      rgba(245,168,0,0.42) 62%,
      rgba(201,136,0,0.30) 82%,
      rgba(107,69,0,0.22)  100%
    );
    -webkit-background-clip: text;
            background-clip: text;
    -webkit-text-fill-color: transparent;
            color: transparent;

    text-shadow:
      0 2px 0 rgba(255,255,255,0.08),
      0 -2px 0 rgba(0,0,0,0.35),
      3px 5px 0 rgba(0,0,0,0.25),
      6px 10px 0 rgba(0,0,0,0.18),
      0 30px 60px rgba(0,0,0,0.45);

    opacity: 0.85;
  }
  .login-logo-text {
    display: flex; flex-direction: column; line-height: 1.15;
  }
  .login-logo-brand {
    font-size: 14px; font-weight: 600; letter-spacing: -0.01em;
  }
  .login-logo-tag {
    font-size: 9.5px; color: ${AWB.gold};
    text-transform: uppercase; letter-spacing: 2px; font-weight: 500;
    margin-top: 3px;
  }

  .login-hero { max-width: 460px; }
  .login-hero-eyebrow {
    font-size: 11px; font-weight: 600; letter-spacing: 2.2px;
    color: ${AWB.gold}; text-transform: uppercase;
    margin-bottom: 14px;
  }
  .login-hero-title {
    font-size: 36px; font-weight: 600; line-height: 1.15;
    letter-spacing: -0.025em;
    margin-bottom: 18px;
  }
  .login-hero-bar {
    width: 56px; height: 4px;
    background: ${AWB.gold};
    border-radius: 2px;
    margin-bottom: 22px;
  }
  .login-hero-lead {
    font-size: 15px; line-height: 1.6;
    color: ${AWB.slate200};
    margin-bottom: 30px;
    font-weight: 400;
  }

  .login-features {
    display: flex; flex-direction: column; gap: 14px;
  }
  .login-feature {
    display: flex; align-items: center; gap: 12px;
    font-size: 13.5px; color: rgba(255,255,255,0.85);
    font-weight: 400;
  }
  .login-feature-dot {
    width: 6px; height: 6px;
    background: ${AWB.gold};
    border-radius: 2px;
    flex-shrink: 0;
    transform: rotate(45deg);
  }

  .login-foot {
    font-size: 11.5px;
    color: rgba(255,255,255,0.45);
    line-height: 1.6;
  }
  .login-foot strong {
    color: ${AWB.slate200};
    font-weight: 500;
    display: block;
    margin-bottom: 2px;
  }

  .login-right {
    background: ${AWB.white};
    display: flex; align-items: center; justify-content: center;
    padding: 48px 40px;
    min-width: 0;
    overflow-y: auto;
  }
  .login-card {
    width: 100%;
    max-width: 420px;
  }
  .login-eyebrow {
    font-size: 10px; font-weight: 600;
    color: ${AWB.gold};
    text-transform: uppercase; letter-spacing: 2.2px;
    margin-bottom: 10px;
  }
  .login-title {
    font-size: 26px; font-weight: 600;
    color: ${AWB.navy};
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }
  .login-sub {
    font-size: 13.5px; color: ${AWB.slate500};
    line-height: 1.55;
    margin-bottom: 28px;
  }

  .login-error {
    display: flex; align-items: flex-start; gap: 10px;
    background: ${AWB.dangerSoft};
    border: 1px solid #FECACA;
    border-radius: 8px;
    padding: 11px 13px; margin-bottom: 18px;
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
    gap: 7px;
    margin-bottom: 16px;
  }
  .login-label {
    font-size: 11px; font-weight: 600;
    color: ${AWB.slate700};
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .login-input-wrap {
    position: relative;
    display: flex; align-items: center;
  }
  .login-input {
    flex: 1; width: 100%;
    border: 1.5px solid ${AWB.slate200};
    background: ${AWB.white};
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    color: ${AWB.navy};
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
    outline: none;
  }
  .login-input.with-toggle { padding-right: 44px; }
  .login-input::placeholder { color: ${AWB.slate400}; }
  .login-input:hover { border-color: ${AWB.slate300}; }
  .login-input:focus {
    border-color: ${AWB.navy};
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
    right: 6px;
    top: 50%; transform: translateY(-50%);
    width: 34px; height: 34px;
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
    margin-bottom: 20px;
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
    background: ${AWB.navy};
    color: ${AWB.white};
    border: 1.5px solid ${AWB.navy};
    border-radius: 8px;
    padding: 13px 20px;
    font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 0.18s ease;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .login-submit:hover:not(:disabled) {
    background: ${AWB.navySoft};
    border-color: ${AWB.navySoft};
    box-shadow: 0 6px 18px rgba(13,27,42,0.22);
    transform: translateY(-1px);
  }
  .login-submit:active:not(:disabled) { transform: translateY(0); }
  .login-submit:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(245,168,0,0.35);
  }
  .login-submit:disabled {
    background: ${AWB.slate200};
    border-color: ${AWB.slate200};
    color: ${AWB.slate500};
    cursor: not-allowed;
  }
  .login-submit-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: ${AWB.white};
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .login-secure {
    margin-top: 22px;
    display: flex; align-items: center; gap: 8px;
    font-size: 11.5px; color: ${AWB.slate500};
    justify-content: center;
  }
  .login-secure svg { color: ${AWB.success}; }

  .login-divider {
    display: flex; align-items: center; gap: 10px;
    color: ${AWB.slate400};
    font-size: 11px; font-weight: 500;
    text-transform: uppercase; letter-spacing: 1.5px;
    margin: 24px 0 14px;
  }
  .login-divider::before,
  .login-divider::after {
    content: ""; flex: 1; height: 1px;
    background: ${AWB.slate200};
  }
  .login-sso {
    width: 100%;
    background: ${AWB.white};
    color: ${AWB.slate700};
    border: 1.5px solid ${AWB.slate200};
    border-radius: 8px;
    padding: 11px 16px;
    font-family: 'Inter', sans-serif;
    font-size: 13px; font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .login-sso:hover {
    background: ${AWB.slate50};
    border-color: ${AWB.slate300};
    color: ${AWB.navy};
  }
  .login-sso:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Responsive */
  @media (max-width: 980px) {
    .login-root { grid-template-columns: 1fr; grid-template-rows: auto 1fr; height: auto; min-height: 100vh; }
    body { overflow: auto; }
    .login-left { padding: 36px 32px; }
    .login-hero-title { font-size: 28px; }
    .login-right { padding: 36px 24px; }
  }
  @media (max-width: 560px) {
    .login-left { padding: 28px 22px; }
    .login-right { padding: 28px 22px; }
    .login-hero-title { font-size: 24px; }
    .login-hero-lead { font-size: 14px; }
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
        {/* ──── Panneau gauche : branding institutionnel ──── */}
        <aside className="login-left">
          <span className="login-bg-w" aria-hidden="true">W</span>

          <div className="login-logo">
            <div className="login-logo-mark">
              <img src={logo} alt="Attijariwafa Bank" className="login-logo-img" />
            </div>
            <div className="login-logo-text">
              <span className="login-logo-brand">Attijariwafa Bank</span>
              <span className="login-logo-tag">Back-Office KYC</span>
            </div>
          </div>

          <div className="login-hero">
            <div className="login-hero-eyebrow">Direction des risques</div>
            <h1 className="login-hero-title">
              Plateforme traitement Back Office<br/>
            </h1>
            <div className="login-hero-bar" />


          </div>

          <div className="login-foot">
            <strong>© 2026 Attijariwafa Bank</strong>
            Environnement réservé aux collaborateurs habilités.
          </div>
        </aside>

        {/* ──── Panneau droit : formulaire ──── */}
        <main className="login-right">
          <div className="login-card">
            <div className="login-eyebrow">Connexion sécurisée</div>
            <h2 className="login-title">Bienvenue.</h2>
            <p className="login-sub">
              Connectez-vous avec vos identifiants professionnels pour accéder à votre espace.
            </p>

            {error && (
              <div className="login-error" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="login-username">Identifiant</label>
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
                <label className="login-label" htmlFor="login-password">Mot de passe</label>
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

            <div className="login-secure">
              <LockIcon />
              <span>Connexion chiffrée TLS · Audit conformité activé</span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
