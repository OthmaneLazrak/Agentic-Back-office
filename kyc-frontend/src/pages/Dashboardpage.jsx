import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AWB } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";

// ─────────────────────── Inline SVG icons ───────────────────────
const Icon = ({ children, size = 16, color = "currentColor", style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
       style={style} aria-hidden="true">
    {children}
  </svg>
);
const IconFolder      = (p) => <Icon {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></Icon>;
const IconClock       = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>;
const IconTrending    = (p) => <Icon {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Icon>;
const IconShield      = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>;
const IconUp          = (p) => <Icon {...p}><polyline points="18 15 12 9 6 15" /></Icon>;
const IconDown        = (p) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>;
const IconDot         = (p) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
const IconCheck       = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
const IconX           = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const IconAlert       = (p) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Icon>;
const IconUpload      = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Icon>;
const IconRefresh     = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Icon>;
const IconArrowUpRight = (p) => <Icon {...p}><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></Icon>;

// ─────────────────────── Hooks ───────────────────────
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    startRef.current = null;
    const from = 0;
    const to = Number(target) || 0;
    const animate = (ts) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function useInterval(callback, delay) {
  const savedRef = useRef(callback);
  useEffect(() => { savedRef.current = callback; }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ─────────────────────── Helpers ───────────────────────
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");

function genSeries(len, base, variance) {
  return Array.from({ length: len }, (_, i) =>
    Math.max(0, Math.round(base + Math.sin(i * 0.6) * variance + (Math.random() - 0.5) * variance))
  );
}

function timeAgo(date) {
  const sec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60)   return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60)   return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24)    return `il y a ${hr} h`;
  return `il y a ${Math.floor(hr / 24)} j`;
}

// ─────────────────────── Sparkline ───────────────────────
function Sparkline({ data, color = AWB.gold, height = 36 }) {
  const safeData = data?.length ? data : [0, 0];
  const w = 120;
  const h = height;
  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData, 0);
  const range = max - min || 1;
  const step = w / (safeData.length - 1);
  const points = safeData.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y];
  });
  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  const gid = useMemo(() => `g-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <svg className="kpi-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────── KPI Card ───────────────────────
function KpiCard({ icon: I, label, value, delta, deltaKind, color, series, selected, onClick }) {
  const animated = useCountUp(value, 1000);
  return (
    <div
      className={`card kpi-card interactive ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-label">
        <I size={12} color={AWB.slate500} />
        {label}
      </div>
      <div className="kpi-value">
        {value < 100 ? fmt(animated) : fmt(animated)}
        {typeof value === "number" && label.toLowerCase().includes("taux") ? "%" : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className={`kpi-delta ${deltaKind}`}>
          {deltaKind === "up"   && <IconUp size={11} />}
          {deltaKind === "down" && <IconDown size={11} />}
          {deltaKind === "flat" && <IconDot size={11} />}
          {delta}
        </span>
        <span style={{ fontSize: 10, color: AWB.slate400 }}>14 j</span>
      </div>
      <Sparkline data={series} color={color} />
    </div>
  );
}

// ─────────────────────── Bar chart ───────────────────────
function BarChart({ data, labels }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const w = 600, h = 200, pad = { l: 28, r: 8, t: 12, b: 24 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...data, 1);
  const barW = innerW / data.length;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map((p, i) => (
          <g key={i}>
            <line
              x1={pad.l} x2={w - pad.r}
              y1={pad.t + innerH - innerH * p}
              y2={pad.t + innerH - innerH * p}
              stroke={AWB.slate100} strokeWidth="1"
            />
            <text
              x={pad.l - 6}
              y={pad.t + innerH - innerH * p + 3}
              fontSize="9" textAnchor="end" fill={AWB.slate400}
            >
              {Math.round(max * p)}
            </text>
          </g>
        ))}

        {/* bars */}
        {data.map((v, i) => {
          const bh = (v / max) * innerH;
          const x = pad.l + i * barW + 2;
          const y = pad.t + innerH - bh;
          return (
            <rect
              key={i}
              className={`chart-bar ${hover === i ? "highlight" : ""}`}
              x={x}
              y={y}
              width={Math.max(2, barW - 4)}
              height={bh}
              rx="3"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        {/* x labels (every other) */}
        {labels.map((l, i) =>
          i % Math.ceil(data.length / 7) === 0 ? (
            <text
              key={i}
              x={pad.l + i * barW + barW / 2}
              y={h - 6}
              fontSize="9" textAnchor="middle" fill={AWB.slate400}
            >
              {l}
            </text>
          ) : null
        )}
      </svg>

      {hover != null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((pad.l + hover * barW + barW / 2) / w) * 100}%`,
            top: `${((pad.t + innerH - (data[hover] / max) * innerH) / h) * 100}%`,
          }}
        >
          {labels[hover]} · <strong>{data[hover]}</strong> dossiers
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Dashboard ───────────────────────
const KPI_TEMPLATE = [
  { key: "traites",  label: "Dossiers traités", icon: IconFolder,   color: AWB.navy,    base: 1284, variance: 30 },
  { key: "pending",  label: "En attente",       icon: IconClock,    color: AWB.gold,    base: 47,   variance: 12 },
  { key: "approval", label: "Taux d'approbation", icon: IconTrending, color: AWB.success, base: 87,   variance: 3  },
  { key: "alerts",   label: "Alertes AML",      icon: IconShield,   color: AWB.danger,  base: 9,    variance: 4  },
];

const EVENT_TEMPLATES = [
  { kind: "success", title: "Dossier #{id} approuvé", agent: "Agent KYC", icon: IconCheck },
  { kind: "danger",  title: "Dossier #{id} rejeté (CIN expirée)", agent: "Agent KYC", icon: IconX },
  { kind: "warning", title: "Dossier #{id} escaladé pour revue", agent: "Superviseur", icon: IconAlert },
  { kind: "info",    title: "Nouveau dossier #{id} reçu", agent: "Front-office", icon: IconUpload },
  { kind: "success", title: "Vérification CIN réussie · #{id}", agent: "Vision Model", icon: IconShield },
];

const DOSSIER_NAMES = ["Yasmine Alaoui", "Karim Benjelloun", "Salma Idrissi", "Mehdi Chraibi", "Nora Tazi", "Rachid El Amrani", "Imane Bennani"];

function genDossier(id) {
  const status = ["approved", "pending", "rejected", "escalated"][Math.floor(Math.random() * 4)];
  return {
    id,
    name: DOSSIER_NAMES[id % DOSSIER_NAMES.length],
    status,
    amount: 100 + Math.floor(Math.random() * 900),
    at: new Date(Date.now() - Math.floor(Math.random() * 3 * 3600 * 1000)),
  };
}

function statusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  const map = {
    approved:  { cls: "badge-approved", label: "Approuvé",  Icon: IconCheck },
    pending:   { cls: "badge-pending",  label: "En attente",Icon: IconClock },
    rejected:  { cls: "badge-rejected", label: "Rejeté",    Icon: IconX },
    escalated: { cls: "badge-info",     label: "Escaladé",  Icon: IconAlert },
  };
  const m = map[normalized] || map.pending;
  return (
    <span className={`badge ${m.cls}`}>
      <m.Icon size={11} />
      {m.label}
    </span>
  );
}

function iconForKind(kind) {
  if (kind === "success") return IconCheck;
  if (kind === "danger") return IconX;
  if (kind === "warning") return IconAlert;
  return IconUpload;
}

function dossierName(dossier) {
  return `${dossier.nom || ""} ${dossier.prenom || ""}`.trim() || "Client non identifié";
}

export default function DashboardPage() {
  const [range, setRange] = useState(14);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get(`/kyc/dashboard`, { params: { range } });
      setStats(res.data);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Dashboard indisponible");
    }
  }, [range]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useInterval(loadStats, 5000);

  const kpis = useMemo(() => KPI_TEMPLATE.map((k) => {
    const values = {
      traites: stats?.processed ?? 0,
      pending: (stats?.pending ?? 0) + (stats?.escalated ?? 0),
      approval: stats?.approvalRate ?? 0,
      alerts: stats?.alerts ?? 0,
    };
    return {
      ...k,
      value: values[k.key],
      series: (stats?.series || []).map((p) => p.value),
      delta: "Base réelle",
      deltaKind: "flat",
    };
  }), [stats]);

  const chartData = useMemo(() => {
    const series = stats?.series || [];
    return {
      values: series.map((p) => p.value),
      labels: series.map((p) => p.label),
    };
  }, [stats]);

  const feed = stats?.recentActivity || [];
  const dossiers = stats?.latestDossiers || [];

  return (
    <div className="dash-root">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="page-label">Vue Générale</div>
          <div className="page-title">Dashboard</div>
        </div>
        <span className="live-pill">
          <span className="live-dot" />
          Données Actives
        </span>
      </div>
      {error && <div className="error-item">{error}</div>}

      {/* ── KPI row ── */}
      <div className="dash-grid dash-row-kpi" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <KpiCard
            key={k.key}
            icon={k.icon}
            label={k.label}
            value={k.value}
            delta={k.delta}
            deltaKind={k.deltaKind}
            color={k.color}
            series={k.series}
            selected={selectedKpi === k.key}
            onClick={() => setSelectedKpi(selectedKpi === k.key ? null : k.key)}
          />
        ))}
      </div>

      {/* ── Chart + feed ── */}
      <div className="dash-grid dash-row-main" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-title" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconTrending size={16} color={AWB.gold} />
              Dossiers traités
            </span>
            <div className="filter-group">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  className={`filter-btn ${range === d ? "active" : ""}`}
                  onClick={() => setRange(d)}
                >
                  {d} j
                </button>
              ))}
            </div>
          </div>
          <BarChart data={chartData.values} labels={chartData.labels} />
          <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 11, color: AWB.slate500 }}>
            <div>Total : <strong style={{ color: AWB.navy }}>{chartData.values.reduce((a, b) => a + b, 0).toLocaleString("fr-FR")}</strong></div>
            <div>Moyenne / jour : <strong style={{ color: AWB.navy }}>{Math.round(chartData.values.reduce((a, b) => a + b, 0) / chartData.values.length)}</strong></div>
            <div>Pic : <strong style={{ color: AWB.navy }}>{Math.max(...chartData.values)}</strong></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconRefresh size={15} color={AWB.gold} />
              Activité récente
            </span>
            <span className="live-pill">
              <span className="live-dot" />
              Live
            </span>
          </div>
          <div className="feed-list" style={{ maxHeight: 260, overflowY: "auto" }}>
            {feed.length === 0 && <div className="bo-empty">Aucune activité enregistrée.</div>}
            {feed.map((e) => {
              const EventIcon = iconForKind(e.kind);
              return (
              <div key={e.id} className="feed-item">
                <div className={`feed-dot ${e.kind}`}>
                  <EventIcon size={14} />
                </div>
                <div className="feed-content">
                  <div className="feed-title">{e.title}</div>
                  <div className="feed-meta">{e.agent} · {timeAgo(new Date(e.created_at))}</div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* ── Dossiers + alerts ── */}
      <div className="dash-grid dash-row-bottom">
        <div className="card">
          <div className="card-title" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconFolder size={16} color={AWB.gold} />
              Derniers dossiers
            </span>
            <button className="btn-outline">
              Voir tout
              <IconArrowUpRight size={11} />
            </button>
          </div>
          <table className="doss-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Client</th>
                <th>Statut</th>
                <th style={{ textAlign: "right" }}>Quand</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ color: AWB.slate500 }}>Aucun dossier en base.</td>
                </tr>
              )}
              {dossiers.map((d) => (
                <tr key={d.id}>
                  <td className="doss-id">#{d.id}</td>
                  <td>{dossierName(d)}</td>
                  <td>{statusBadge(d.statut)}</td>
                  <td style={{ textAlign: "right", color: AWB.slate500, fontSize: 11.5 }}>
                    {timeAgo(new Date(d.updated_at || d.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconShield size={16} color={AWB.gold} />
              Alertes AML
            </span>
            <span className="badge badge-rejected" style={{ fontSize: 10 }}>
              {stats?.alerts ?? 0} actives
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(stats?.notifications || []).length === 0 && <div className="bo-empty">Aucune notification Back Office.</div>}
            {(stats?.notifications || []).map((a, i) => {
              const cls = "warning";
              return (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "10px 12px",
                  background: AWB.slate50, border: `1px solid ${AWB.slate200}`,
                  borderRadius: 8, cursor: "pointer", transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = AWB.slate300; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = AWB.slate50; e.currentTarget.style.borderColor = AWB.slate200; }}
                >
                  <div className={`feed-dot ${cls}`}>
                    <IconAlert size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: AWB.slate800 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: AWB.slate500, marginTop: 2 }}>{a.motif}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
