import { AWB } from "../constants/Theme.jsx";

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: ${AWB.slate50};
    color: ${AWB.slate900};
    height: 100vh;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ─────────────────────── Sidebar ─────────────────────── */
  .sidebar {
    width: 240px; min-width: 240px;
    background: ${AWB.navy};
    display: flex; flex-direction: column;
    height: 100vh; overflow-y: auto;
    position: relative;
    border-right: 1px solid rgba(255,255,255,0.04);
  }
  .sidebar-logo {
    padding: 22px 20px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; gap: 12px;
  }
  .sidebar-logo-img {
    width: 38px; height: 38px;
    object-fit: contain;
    border-radius: 8px;
    flex-shrink: 0;
    background: white;
    padding: 4px;
  }
  .sidebar-brand {
    font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 600;
    color: white; line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .sidebar-tagline {
    font-size: 9px; color: ${AWB.gold};
    letter-spacing: 2px; text-transform: uppercase; font-weight: 500;
    margin-top: 2px;
  }

  .sidebar-section { padding: 22px 0 4px; }
  .sidebar-section-label {
    font-size: 10px; font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); padding: 0 20px; margin-bottom: 8px;
  }

  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 20px; cursor: pointer;
    font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.6);
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
    text-decoration: none;
  }
  .nav-item:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); }
  .nav-item.active {
    background: rgba(245,168,0,0.08);
    color: white; font-weight: 500;
    border-left-color: ${AWB.gold};
  }
  .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; opacity: 0.85; }
  .nav-badge {
    margin-left: auto; background: ${AWB.gold}; color: ${AWB.navy};
    font-size: 10px; font-weight: 700; padding: 1px 7px;
    border-radius: 10px; min-width: 18px; text-align: center;
  }

  .sidebar-user {
    margin-top: auto;
    padding: 16px 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; gap: 12px;
  }
  .user-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: ${AWB.gold}; color: ${AWB.navy};
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; flex-shrink: 0;
  }
  .user-name { font-size: 12px; font-weight: 500; color: white; line-height: 1.3; }
  .user-role { font-size: 10px; color: rgba(255,255,255,0.4); }

  /* ─────────────────────── Topbar ─────────────────────── */
  .topbar {
    height: 64px; background: white;
    border-bottom: 1px solid ${AWB.slate200};
    display: flex; align-items: center;
    padding: 0 24px; gap: 16px;
    flex-shrink: 0;
    position: relative;
    z-index: 20;
  }

  /* Title block (left) — what is this page */
  .tb-title-block {
    display: flex; flex-direction: column;
    line-height: 1.2;
    flex-shrink: 0;
  }
  .tb-title {
    font-size: 15px;
    font-weight: 600;
    color: ${AWB.navy};
    letter-spacing: -0.01em;
  }
  .tb-subtitle {
    font-size: 11px;
    color: ${AWB.slate500};
    font-weight: 500;
    margin-top: 2px;
    letter-spacing: 0.01em;
  }

  /* Environment indicator — safety-critical in a banking back-office */
  .tb-env {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 1px solid;
    flex-shrink: 0;
  }
  .tb-env-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 0 currentColor;
    animation: envPulse 2s ease-in-out infinite;
  }
  @keyframes envPulse {
    0%   { box-shadow: 0 0 0 0 currentColor; }
    70%  { box-shadow: 0 0 0 6px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  .tb-env-prod {
    color: ${AWB.danger};
    background: ${AWB.dangerSoft};
    border-color: #FECACA;
  }
  .tb-env-test {
    color: ${AWB.warning};
    background: ${AWB.warningSoft};
    border-color: #FDE68A;
  }
  .tb-env-dev {
    color: ${AWB.info};
    background: ${AWB.infoSoft};
    border-color: #BFDBFE;
  }
  .tb-env-label { line-height: 1; }

  /* Pending dossiers (operational counter) */
  .tb-pending {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 7px 12px;
    background: ${AWB.slate50};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Inter', sans-serif;
    color: ${AWB.slate700};
  }
  .tb-pending:hover {
    background: white;
    border-color: ${AWB.gold};
    color: ${AWB.navy};
    box-shadow: 0 2px 6px rgba(15,23,42,0.04);
  }
  .tb-pending-count {
    font-size: 13px;
    font-weight: 700;
    color: ${AWB.navy};
    font-variant-numeric: tabular-nums;
  }
  .tb-pending-label {
    font-size: 11px;
    font-weight: 500;
    color: ${AWB.slate500};
  }
  .tb-pending:hover .tb-pending-label { color: ${AWB.slate700}; }

  /* Search (center) */
  .tb-search {
    flex: 1; max-width: 440px;
    margin: 0 auto;
    display: flex; align-items: center; gap: 10px;
    background: ${AWB.slate50};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px; padding: 0 12px; height: 38px;
    transition: all 0.2s ease;
  }
  .tb-search:focus-within {
    border-color: ${AWB.gold};
    box-shadow: 0 0 0 3px rgba(245,168,0,0.12);
    background: white;
  }
  .tb-search input {
    flex: 1;
    border: none; background: transparent; outline: none;
    font-size: 13px; color: ${AWB.slate900};
    font-family: 'Inter', sans-serif;
  }
  .tb-search input::placeholder { color: ${AWB.slate400}; }
  .tb-kbd {
    font-family: 'Inter', sans-serif;
    font-size: 10px; font-weight: 600;
    color: ${AWB.slate500};
    background: white;
    border: 1px solid ${AWB.slate200};
    border-radius: 4px;
    padding: 2px 6px;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  /* Right cluster */
  .tb-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .tb-vsep {
    width: 1px; height: 24px;
    background: ${AWB.slate200};
    margin: 0 4px;
  }

  /* Live clock */
  .tb-clock {
    display: flex; flex-direction: column; align-items: flex-end;
    padding-right: 6px;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .tb-clock-date {
    font-size: 10.5px; color: ${AWB.slate500};
    font-weight: 500;
    text-transform: capitalize;
    letter-spacing: 0.02em;
  }
  .tb-clock-time {
    font-size: 13px; font-weight: 600; color: ${AWB.navy};
    margin-top: 1px;
    letter-spacing: 0.02em;
  }

  /* Icon button */
  .tb-icon-btn {
    position: relative;
    width: 36px; height: 36px;
    border-radius: 8px;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer;
    color: ${AWB.slate600};
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    font-family: 'Inter', sans-serif;
    padding: 0;
  }
  .tb-icon-btn:hover {
    background: ${AWB.slate50};
    border-color: ${AWB.slate200};
    color: ${AWB.navy};
  }
  .tb-icon-btn.active {
    background: ${AWB.slate50};
    border-color: ${AWB.slate300};
    color: ${AWB.navy};
  }
  .tb-icon-btn.pill {
    width: auto;
    gap: 6px;
    padding: 0 10px;
  }

  .tb-badge {
    position: absolute;
    top: 4px; right: 4px;
    min-width: 16px; height: 16px;
    border-radius: 8px;
    background: ${AWB.danger};
    color: white;
    font-size: 9.5px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px;
    border: 2px solid white;
    box-sizing: content-box;
    letter-spacing: 0.02em;
  }

  /* User trigger (right) */
  .tb-user-trigger {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 10px 4px 4px;
    border-radius: 24px;
    background: ${AWB.slate50};
    border: 1px solid ${AWB.slate200};
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Inter', sans-serif;
  }
  .tb-user-trigger:hover {
    background: white;
    border-color: ${AWB.slate300};
    box-shadow: 0 2px 6px rgba(15,23,42,0.04);
  }
  .tb-user-trigger.active {
    background: white;
    border-color: ${AWB.gold};
    box-shadow: 0 0 0 3px rgba(245,168,0,0.12);
  }
  .tb-user-text {
    display: flex; flex-direction: column;
    line-height: 1.2;
    align-items: flex-start;
  }
  .topbar-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, ${AWB.navy} 0%, ${AWB.navySoft} 100%);
    color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 10.5px; font-weight: 700;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .topbar-username { font-size: 12px; font-weight: 600; color: ${AWB.navy}; }
  .topbar-role { font-size: 10px; color: ${AWB.slate500}; font-weight: 500; margin-top: 1px; }

  /* Popovers */
  .tb-menu-wrap { position: relative; }
  .tb-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 320px;
    background: white;
    border: 1px solid ${AWB.slate200};
    border-radius: 10px;
    box-shadow: 0 12px 36px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06);
    z-index: 100;
    overflow: hidden;
    animation: tbPopIn 0.18s ease-out;
  }
  .tb-popover.user { min-width: 260px; }
  .tb-popover.lang { min-width: 180px; padding: 6px; }
  @keyframes tbPopIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .tb-popover-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid ${AWB.slate100};
  }
  .tb-popover-action {
    background: transparent; border: none;
    color: ${AWB.gold};
    font-size: 11px; font-weight: 600;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    padding: 4px 6px; border-radius: 5px;
    transition: background 0.15s ease;
  }
  .tb-popover-action:hover { background: ${AWB.goldLight}; }
  .tb-popover-list { max-height: 320px; overflow-y: auto; }
  .tb-popover-foot {
    padding: 10px 14px;
    border-top: 1px solid ${AWB.slate100};
    font-size: 11.5px; font-weight: 500;
    color: ${AWB.navy};
    text-align: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .tb-popover-foot:hover { background: ${AWB.slate50}; }

  /* Notif row */
  .tb-notif {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 10px 14px;
    border-bottom: 1px solid ${AWB.slate100};
    transition: background 0.15s ease;
    cursor: pointer;
  }
  .tb-notif:last-child { border-bottom: none; }
  .tb-notif:hover { background: ${AWB.slate50}; }
  .tb-notif.unread { background: ${AWB.goldLight}; }
  .tb-notif.unread:hover { background: #FFEFC9; }
  .tb-notif-dot {
    width: 8px; height: 8px; border-radius: 50%;
    margin-top: 6px; flex-shrink: 0;
  }
  .tb-notif-dot.alert   { background: ${AWB.danger}; }
  .tb-notif-dot.success { background: ${AWB.success}; }
  .tb-notif-dot.warning { background: ${AWB.warning}; }
  .tb-notif-dot.info    { background: ${AWB.info}; }
  .tb-notif-title { font-size: 12.5px; color: ${AWB.navy}; font-weight: 500; line-height: 1.4; }
  .tb-notif-meta  { font-size: 11px; color: ${AWB.slate500}; margin-top: 2px; }

  /* User popover */
  .tb-user-head {
    display: flex; align-items: center; gap: 10px;
    padding: 14px;
    border-bottom: 1px solid ${AWB.slate100};
  }
  .tb-user-head-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, ${AWB.navy} 0%, ${AWB.navySoft} 100%);
    color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    flex-shrink: 0;
  }
  .tb-user-items { padding: 6px; }
  .tb-user-foot { border-top: 1px solid ${AWB.slate100}; padding: 6px; }
  .tb-user-item {
    width: 100%;
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    border: none; background: transparent;
    border-radius: 6px;
    font-family: 'Inter', sans-serif;
    font-size: 12.5px; font-weight: 500;
    color: ${AWB.slate800};
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: left;
  }
  .tb-user-item:hover { background: ${AWB.slate50}; }
  .tb-user-item.danger { color: ${AWB.danger}; }
  .tb-user-item.danger:hover { background: ${AWB.dangerSoft}; }

  /* ─────────────────────── Layout ─────────────────────── */
  .layout { display: flex; height: 100vh; overflow: hidden; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: ${AWB.slate50}; }
  .content {
    flex: 1;
    overflow: hidden;          /* no scrollbar gutter on the outer pane */
    padding: 24px 30px;
    min-height: 0;
    position: relative;
  }
  /* Toggle wrappers in App.jsx (.content > div) fill the available height */
  .content > div { height: 100%; min-height: 0; }

  /* KYC fills the .content area and never scrolls (no inherited padding) */
  .kyc-root {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .kyc-page {
    flex: 1;
    height: 100%;
    min-height: 0;
    display: flex; flex-direction: column; gap: 14px;
  }
  .kyc-grid {
    flex: 1; min-height: 0;
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  }
  .col-scroll {
    min-height: 0;
    overflow-y: auto;
    padding-right: 6px;
    display: flex; flex-direction: column; gap: 16px;
  }

  /* Column that does NOT scroll — children share the available height,
     and any card flagged .card-fill grows to fill what's left. */
  .col-stack {
    min-height: 0;
    overflow: hidden;
    display: flex; flex-direction: column;
    gap: 14px;
  }
  .col-fill {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .col-fill > .card { flex: 1; min-height: 0; }

  .card.card-fill {
    display: flex; flex-direction: column;
    min-height: 0;
  }
  .card-body-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }

  /* Compact docs strip — shown after analysis */
  .docs-strip {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  }
  .doc-thumb-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    background: ${AWB.slate50};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px;
    min-width: 0;
  }
  .doc-thumb {
    width: 44px; height: 44px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid ${AWB.slate200};
    flex-shrink: 0;
    background: white;
  }
  .doc-thumb-info { min-width: 0; flex: 1; }
  .doc-thumb-label {
    font-size: 10px; font-weight: 600;
    color: ${AWB.slate500};
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .doc-thumb-name {
    font-size: 12px; font-weight: 500;
    color: ${AWB.slate800};
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 1px;
  }

  /* ─────────────────────── Page header ─────────────────────── */
  .page-header { margin-bottom: 18px; }
  .page-header.compact { margin-bottom: 12px; }
  .page-label {
    font-size: 10px; font-weight: 600; letter-spacing: 2px;
    text-transform: uppercase; color: ${AWB.gold};
    margin-bottom: 6px;
  }
  .page-title {
    font-family: 'Inter', sans-serif;
    font-size: 26px; font-weight: 600;
    color: ${AWB.navy};
    letter-spacing: -0.02em;
  }

  /* ─────────────────────── Cards ─────────────────────── */
  .card {
    background: white;
    border: 1px solid ${AWB.slate200};
    border-radius: 12px;
    padding: 18px 20px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .card.compact { padding: 14px 16px; }
  .card.interactive { cursor: pointer; }
  .card.interactive:hover {
    border-color: ${AWB.slate300};
    box-shadow: 0 6px 20px rgba(15,23,42,0.06);
    transform: translateY(-1px);
  }
  .card.selected {
    border-color: ${AWB.gold};
    box-shadow: 0 0 0 3px rgba(245,168,0,0.12);
  }
  .card-title {
    font-family: 'Inter', sans-serif;
    font-size: 13px; font-weight: 600;
    color: ${AWB.navy};
    margin-bottom: 14px;
    display: flex; align-items: center; gap: 10px;
    letter-spacing: -0.01em;
  }
  .card-title svg { color: ${AWB.gold}; }
  .card-subtitle {
    font-size: 10px; font-weight: 600;
    color: ${AWB.slate500};
    text-transform: uppercase;
    letter-spacing: 1.4px;
    margin-bottom: 10px;
  }

  /* ─────────────────────── Upload zone ─────────────────────── */
  .upload-zone {
    border: 1.5px dashed ${AWB.slate300};
    border-radius: 10px;
    padding: 22px 16px;
    text-align: center; cursor: pointer;
    transition: all 0.2s ease;
    background: ${AWB.slate50};
    display: flex; flex-direction: column; align-items: center; gap: 3px;
  }
  .upload-zone.compact {
    padding: 16px 12px;
  }

  /* Two upload zones side-by-side */
  .upload-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .upload-slot {
    display: flex; flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .file-meta {
    display: flex; align-items: center; gap: 6px;
    margin-top: 2px;
  }
  .file-meta .chip {
    flex: 1; min-width: 0;
    overflow: hidden;
  }
  .chip-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .btn-icon {
    padding: 4px 6px !important;
    flex-shrink: 0;
  }
  .upload-zone:hover {
    border-color: ${AWB.gold};
    background: ${AWB.goldLight};
  }
  .upload-zone:hover .upload-icon-wrap {
    background: ${AWB.gold};
    color: white;
  }
  .upload-zone.dragging {
    border-color: ${AWB.gold};
    background: ${AWB.goldLight};
    transform: scale(1.005);
  }
  .upload-icon-wrap {
    width: 38px; height: 38px;
    background: white;
    border: 1px solid ${AWB.slate200};
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 8px;
    color: ${AWB.slate500};
    transition: all 0.2s ease;
  }
  .upload-text { font-size: 13px; font-weight: 500; color: ${AWB.slate800}; }
  .upload-sub { font-size: 11px; color: ${AWB.slate500}; margin-top: 2px; }
  .upload-icon { display: none; }

  /* ─────────────────────── Buttons ─────────────────────── */
  .btn-primary {
    background: ${AWB.navy};
    color: white;
    border: 1px solid ${AWB.navy};
    border-radius: 8px;
    padding: 11px 20px;
    font-family: 'Inter', sans-serif;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s ease;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    letter-spacing: 0.01em;
  }
  .btn-primary:hover:not(:disabled) {
    background: ${AWB.navySoft};
    border-color: ${AWB.navySoft};
    box-shadow: 0 4px 12px rgba(13,27,42,0.18);
  }
  .btn-primary:active:not(:disabled) { transform: translateY(1px); }
  .btn-primary:disabled {
    background: ${AWB.slate200};
    border-color: ${AWB.slate200};
    color: ${AWB.slate500};
    cursor: not-allowed;
  }

  .btn-outline {
    background: white; color: ${AWB.slate700};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 12px; font-weight: 500;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-outline:hover { background: ${AWB.slate50}; border-color: ${AWB.slate300}; color: ${AWB.navy}; }

  .btn-approve {
    background: ${AWB.success}; color: white;
    border: 1px solid ${AWB.success};
    border-radius: 8px; padding: 9px 16px;
    font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-approve:hover:not(:disabled) { background: #166534; box-shadow: 0 4px 12px rgba(21,128,61,0.22); }

  .btn-reject {
    background: white; color: ${AWB.danger};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px; padding: 9px 16px;
    font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-reject:hover:not(:disabled) {
    background: ${AWB.dangerSoft};
    border-color: ${AWB.danger};
  }

  .btn-escalate {
    background: white; color: ${AWB.warning};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px; padding: 9px 16px;
    font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-escalate:hover:not(:disabled) {
    background: ${AWB.warningSoft};
    border-color: ${AWB.warning};
  }

  /* ─────────────────────── Badges ─────────────────────── */
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.01em;
  }
  .badge-approved { background: ${AWB.successSoft}; color: ${AWB.success}; border: 1px solid #BBF7D0; }
  .badge-rejected { background: ${AWB.dangerSoft};  color: ${AWB.danger};  border: 1px solid #FECACA; }
  .badge-pending  { background: ${AWB.warningSoft}; color: ${AWB.warning}; border: 1px solid #FDE68A; }
  .badge-info     { background: ${AWB.infoSoft};    color: ${AWB.info};    border: 1px solid #BFDBFE; }

  /* Confidence pills — small, thin, no fioritures */
  .confidence-pill {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 500;
    padding: 2px 7px; border-radius: 4px;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
  }
  .confidence-high   { color: ${AWB.success}; background: ${AWB.successSoft}; border-color: #BBF7D0; }
  .confidence-medium { color: ${AWB.warning}; background: ${AWB.warningSoft}; border-color: #FDE68A; }
  .confidence-low    { color: ${AWB.danger};  background: ${AWB.dangerSoft};  border-color: #FECACA; }
  .confidence-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: currentColor;
  }

  /* ─────────────────────── Check items ─────────────────────── */
  .check-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 0;
    border-bottom: 1px solid ${AWB.slate100};
    font-size: 12.5px;
    transition: background 0.15s ease;
  }
  .check-item:last-child { border-bottom: none; }
  .check-label {
    color: ${AWB.slate700};
    display: flex; align-items: center; gap: 10px;
    font-weight: 400;
  }
  .check-label svg { flex-shrink: 0; }
  .check-value {
    font-weight: 600; font-size: 11.5px;
    padding: 3px 8px; border-radius: 5px;
  }
  .check-ok      { color: ${AWB.success}; background: ${AWB.successSoft}; }
  .check-error   { color: ${AWB.danger};  background: ${AWB.dangerSoft}; }
  .check-warning { color: ${AWB.warning}; background: ${AWB.warningSoft}; }
  .check-info    { color: ${AWB.info};    background: ${AWB.infoSoft}; }

  /* ─────────────────────── Risk gauge ─────────────────────── */
  .risk-gauge { text-align: center; padding: 14px 0; }
  .risk-score { font-size: 44px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
  .risk-low    { color: ${AWB.success}; }
  .risk-medium { color: ${AWB.warning}; }
  .risk-high   { color: ${AWB.danger}; }
  .risk-label { font-size: 12px; font-weight: 600; margin-top: 6px; }
  .risk-desc { font-size: 11px; color: ${AWB.slate500}; margin-top: 8px; line-height: 1.5; }

  /* ─────────────────────── Editable data fields (Human-in-the-loop) ─────────────────────── */
  .field-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .field-row:last-child { margin-bottom: 0; }
  .field-label {
    font-size: 10px; font-weight: 600;
    color: ${AWB.slate500};
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .field-input-wrap {
    display: flex; align-items: center; gap: 8px;
  }
  .field-input {
    flex: 1;
    width: 100%;
    border: 1px solid ${AWB.slate200};
    background: white;
    border-radius: 7px;
    padding: 8px 10px;
    font-family: 'Inter', sans-serif;
    font-size: 12.5px;
    font-weight: 500;
    color: ${AWB.navy};
    transition: all 0.2s ease;
    outline: none;
  }
  .field-input:hover { border-color: ${AWB.slate300}; }
  .field-input:focus {
    border-color: ${AWB.gold};
    box-shadow: 0 0 0 3px rgba(245,168,0,0.15);
    background: white;
  }

  /* Legacy data-table — kept for any consumer that still uses it */
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table td { padding: 8px 4px; font-size: 12px; border-bottom: 1px solid ${AWB.slate100}; }
  .data-table td:first-child { color: ${AWB.slate500}; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; width: 45%; }
  .data-table td:last-child { color: ${AWB.navy}; font-weight: 600; }
  .data-table tr:last-child td { border-bottom: none; }

  /* ─────────────────────── Error list ─────────────────────── */
  .error-item {
    display: flex; align-items: flex-start; gap: 10px;
    background: ${AWB.dangerSoft};
    border: 1px solid #FECACA;
    border-radius: 8px;
    padding: 10px 12px; margin-bottom: 8px;
    font-size: 11.5px; color: ${AWB.danger};
    line-height: 1.5;
  }
  .error-item svg { flex-shrink: 0; margin-top: 1px; }

  /* ─────────────────────── Spinner / skeleton ─────────────────────── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .skeleton {
    background: linear-gradient(
      90deg,
      ${AWB.slate100} 0%,
      ${AWB.slate200} 40%,
      ${AWB.slate100} 80%
    );
    background-size: 800px 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-radius: 6px;
    display: block;
  }
  .skeleton-line { height: 12px; margin-bottom: 10px; }
  .skeleton-line:last-child { margin-bottom: 0; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
  .pulse { animation: pulse 1.6s ease-in-out infinite; }

  /* ─────────────────────── Divider ─────────────────────── */
  .divider { height: 1px; background: ${AWB.slate200}; margin: 18px 0; }

  /* ─────────────────────── Image preview ─────────────────────── */
  .doc-preview {
    width: 100%; border-radius: 10px; overflow: hidden;
    border: 1px solid ${AWB.slate200}; background: ${AWB.slate50};
    display: flex; align-items: center; justify-content: center;
    height: 110px;
    position: relative;
  }
  .doc-preview img { width: 100%; height: 100%; display: block; object-fit: contain; }

  /* ─────────────────────── Steps bar ─────────────────────── */
  .steps-bar {
    display: flex; align-items: center;
    background: white;
    border: 1px solid ${AWB.slate200};
    border-radius: 10px;
    padding: 12px 20px;
  }
  .step-item { display: flex; align-items: center; gap: 10px; flex: 1; }
  .step-item:last-child { flex: 0; }
  .step-circle {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    flex-shrink: 0;
    transition: all 0.25s ease;
    border: 1.5px solid transparent;
  }
  .step-circle.done   { background: ${AWB.success}; color: white; }
  .step-circle.active {
    background: white; color: ${AWB.gold};
    border-color: ${AWB.gold};
    box-shadow: 0 0 0 4px rgba(245,168,0,0.14);
  }
  .step-circle.idle   { background: ${AWB.slate100}; color: ${AWB.slate400}; border-color: ${AWB.slate200}; }
  .step-label { font-size: 12px; font-weight: 500; transition: color 0.2s ease; }
  .step-label.active { color: ${AWB.navy}; font-weight: 600; }
  .step-label.done   { color: ${AWB.success}; }
  .step-label.idle   { color: ${AWB.slate400}; }
  .step-line { flex: 1; height: 1px; background: ${AWB.slate200}; margin: 0 10px; transition: background 0.3s ease; }
  .step-line.done { background: ${AWB.success}; }

  /* ─────────────────────── Agent report ─────────────────────── */
  .agent-report {
    background: ${AWB.slate50};
    border: 1px solid ${AWB.slate200};
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px; line-height: 1.65;
    color: ${AWB.slate800};
    border-left: 3px solid ${AWB.gold};
    white-space: pre-wrap;
    font-family: 'Inter', sans-serif;
    max-height: 140px; overflow-y: auto;
  }

  /* ─────────────────────── Tabs ─────────────────────── */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid ${AWB.slate200}; margin-bottom: 20px; }
  .tab {
    padding: 9px 16px; font-size: 12px; font-weight: 500; cursor: pointer;
    color: ${AWB.slate500};
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s ease;
  }
  .tab.active { color: ${AWB.navy}; border-bottom-color: ${AWB.gold}; font-weight: 600; }
  .tab:hover:not(.active) { color: ${AWB.slate800}; }

  /* ─────────────────────── Action bar ─────────────────────── */
  .action-bar { display: flex; gap: 8px; margin-top: 18px; align-items: center; }

  /* ─────────────────────── Grid helpers ─────────────────────── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

  /* ─────────────────────── Chips ─────────────────────── */
  .chip {
    background: ${AWB.slate100};
    border: 1px solid ${AWB.slate200};
    color: ${AWB.slate700};
    border-radius: 6px;
    padding: 4px 9px;
    font-size: 11px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 5px;
  }

  /* ─────────────────────── AI badge ─────────────────────── */
  .ai-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: ${AWB.slate50};
    border: 1px solid ${AWB.slate200};
    color: ${AWB.slate600};
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 10.5px; font-weight: 500;
    letter-spacing: 0.02em;
  }
  .ai-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: ${AWB.gold};
    animation: pulse 1.6s ease-in-out infinite;
  }

  /* ─────────────────────── Dashboard ─────────────────────── */
  .dash-root {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }
  .kpi-card { padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
  .kpi-label {
    font-size: 10px; font-weight: 600;
    color: ${AWB.slate500};
    text-transform: uppercase;
    letter-spacing: 1.4px;
    display: flex; align-items: center; gap: 6px;
  }
  .kpi-value {
    font-size: 26px; font-weight: 700;
    color: ${AWB.navy};
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .kpi-delta {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 600;
    padding: 2px 7px; border-radius: 5px;
  }
  .kpi-delta.up   { color: ${AWB.success}; background: ${AWB.successSoft}; }
  .kpi-delta.down { color: ${AWB.danger};  background: ${AWB.dangerSoft};  }
  .kpi-delta.flat { color: ${AWB.slate500}; background: ${AWB.slate100}; }
  .kpi-sparkline { margin-top: 4px; height: 36px; width: 100%; }

  .dash-grid { display: grid; gap: 16px; }
  .dash-row-kpi { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .dash-row-main { grid-template-columns: 1.6fr 1fr; }
  .dash-row-bottom { grid-template-columns: 1.4fr 1fr; }

  .chart-wrap { position: relative; height: 200px; }
  .chart-bar {
    fill: ${AWB.slate200};
    transition: fill 0.2s ease, y 0.2s ease, height 0.2s ease;
    cursor: pointer;
  }
  .chart-bar:hover { fill: ${AWB.gold}; }
  .chart-bar.highlight { fill: ${AWB.navy}; }
  .chart-tooltip {
    position: absolute;
    background: ${AWB.navy}; color: white;
    padding: 6px 10px; border-radius: 6px;
    font-size: 11px; font-weight: 500;
    pointer-events: none; white-space: nowrap;
    transform: translate(-50%, -120%);
    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  }
  .chart-tooltip::after {
    content: ''; position: absolute;
    left: 50%; bottom: -4px; transform: translateX(-50%);
    width: 8px; height: 8px; background: ${AWB.navy};
    transform: translate(-50%, 0) rotate(45deg);
  }
  .filter-group {
    display: inline-flex; padding: 3px;
    background: ${AWB.slate100};
    border-radius: 8px;
    gap: 2px;
  }
  .filter-btn {
    background: transparent; border: none;
    padding: 5px 12px;
    font-size: 11px; font-weight: 500;
    color: ${AWB.slate600};
    border-radius: 6px;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
  }
  .filter-btn:hover { color: ${AWB.navy}; }
  .filter-btn.active {
    background: white; color: ${AWB.navy};
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(15,23,42,0.08);
  }

  /* Activity feed */
  .feed-list { display: flex; flex-direction: column; }
  .feed-item {
    display: flex; gap: 12px; padding: 10px 0;
    border-bottom: 1px solid ${AWB.slate100};
    transition: background 0.15s ease;
  }
  .feed-item:last-child { border-bottom: none; }
  .feed-item.new {
    animation: feedSlideIn 0.35s ease-out;
  }
  @keyframes feedSlideIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .feed-dot {
    width: 30px; height: 30px; border-radius: 8px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .feed-dot.success { background: ${AWB.successSoft}; color: ${AWB.success}; }
  .feed-dot.danger  { background: ${AWB.dangerSoft};  color: ${AWB.danger}; }
  .feed-dot.warning { background: ${AWB.warningSoft}; color: ${AWB.warning}; }
  .feed-dot.info    { background: ${AWB.infoSoft};    color: ${AWB.info}; }
  .feed-content { flex: 1; min-width: 0; }
  .feed-title { font-size: 12.5px; font-weight: 500; color: ${AWB.slate800}; line-height: 1.4; }
  .feed-meta { font-size: 11px; color: ${AWB.slate500}; margin-top: 2px; }

  /* Dossiers table */
  .doss-table { width: 100%; border-collapse: collapse; }
  .doss-table th {
    text-align: left; padding: 8px 10px;
    font-size: 10px; font-weight: 600;
    color: ${AWB.slate500};
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid ${AWB.slate200};
  }
  .doss-table td {
    padding: 10px;
    font-size: 12.5px;
    border-bottom: 1px solid ${AWB.slate100};
    color: ${AWB.slate800};
  }
  .doss-table tr { transition: background 0.15s ease; }
  .doss-table tbody tr:hover { background: ${AWB.slate50}; }
  .doss-table tbody tr:last-child td { border-bottom: none; }
  .doss-id { font-variant-numeric: tabular-nums; font-weight: 600; color: ${AWB.navy}; }

  /* Live indicator */
  .live-pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10px; font-weight: 600;
    color: ${AWB.success};
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: ${AWB.success};
    box-shadow: 0 0 0 0 rgba(21,128,61,0.6);
    animation: liveBlink 1.6s ease-in-out infinite;
  }
  @keyframes liveBlink {
    0%   { box-shadow: 0 0 0 0   rgba(21,128,61,0.55); }
    70%  { box-shadow: 0 0 0 8px rgba(21,128,61,0); }
    100% { box-shadow: 0 0 0 0   rgba(21,128,61,0); }
  }

  /* ─────────────────────── Scrollbar ─────────────────────── */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: ${AWB.slate300}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: ${AWB.slate400}; }
  ::-webkit-scrollbar-track { background: transparent; }
`;
