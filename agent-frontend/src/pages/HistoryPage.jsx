import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AWB, ROLES } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";
import DossierDetailModal from "../components/DossierDetailModal.jsx";

const Icon = ({ children, size = 16, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconRefresh = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></Icon>;
const IconSearch  = (p) => <Icon {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
const IconInbox   = (p) => <Icon {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Icon>;
const IconFilter  = (p) => <Icon {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></Icon>;
const IconCheck   = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
const IconChevL   = (p) => <Icon {...p}><polyline points="15 18 9 12 15 6" /></Icon>;
const IconChevR   = (p) => <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>;

const PAGE_SIZE = 7;

// Fenêtre de numéros de page avec ellipses (current est 0-indexé).
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const c = current + 1;
  const pages = [1];
  if (c > 3) pages.push("…");
  for (let i = Math.max(2, c - 1); i <= Math.min(total - 1, c + 1); i++) pages.push(i);
  if (c < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

const STATUS_META = {
  PENDING:   { cls: "badge-pending",  label: "En attente" },
  APPROVED:  { cls: "badge-approved", label: "Approuvé" },
  REJECTED:  { cls: "badge-rejected", label: "Rejeté" },
  ESCALATED: { cls: "badge-info",     label: "Escaladé" },
};

const STATUS_FILTERS = [
  { id: "ALL",       label: "Tous" },
  { id: "PENDING",   label: "En attente" },
  { id: "ESCALATED", label: "Escaladés" },
  { id: "APPROVED",  label: "Approuvés" },
  { id: "REJECTED",  label: "Rejetés" },
];

const KIND_FILTERS = [
  { id: "all",    label: "Tous types" },
  { id: "kyc",    label: "KYC" },
  { id: "cheque", label: "Chèque" },
];

function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function dossierTitle(d) {
  if (d.kind === "cheque") return d.beneficiaire || `Chèque #${d.id}`;
  const full = `${d.nom || ""} ${d.prenom || ""}`.trim();
  return full || (d.cin ? `CIN ${d.cin}` : `Dossier #${d.id}`);
}

export default function HistoryPage({ userRole = ROLES.FRONT_OFFICE, userId = null }) {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);
  const filterRef = useRef(null);

  // Ferme le menu de filtre au clic extérieur.
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);

  const activeFilters = (statusFilter !== "ALL" ? 1 : 0) + (kindFilter !== "all" ? 1 : 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kycRes, chequeRes] = await Promise.all([
        api.get("/kyc/dossiers").catch(() => ({ data: [] })),
        api.get("/cheque/dossiers").catch(() => ({ data: [] })),
      ]);
      const merged = [
        ...(kycRes.data || []).map((d) => ({ ...d, kind: "kyc" })),
        ...(chequeRes.data || []).map((d) => ({ ...d, kind: "cheque" })),
      ];

      // Front Office : ses propres dossiers. Back Office : la file escaladée
      // + les dossiers qu'il a lui-même traités.
      const mine = merged.filter((d) => {
        if (userRole === ROLES.FRONT_OFFICE) {
          return userId != null && d.created_by_user_id === userId;
        }
        if (userRole === ROLES.BACK_OFFICE) {
          return d.statut === "ESCALATED" || (userId != null && d.handled_by_user_id === userId);
        }
        return true; // admin / autres : tout
      });

      mine.sort((a, b) =>
        new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );
      setDossiers(mine);
    } catch (e) {
      setError(e?.response?.data?.message || "Impossible de charger l'historique.");
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  }, [userRole, userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (statusFilter !== "ALL" && d.statut !== statusFilter) return false;
      if (kindFilter !== "all" && d.kind !== kindFilter) return false;
      if (q) {
        const hay = `${dossierTitle(d)} #${d.id} ${d.cin || ""} ${d.beneficiaire || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dossiers, statusFilter, kindFilter, query]);

  // Retour à la première page quand les filtres / la recherche changent.
  useEffect(() => { setPage(0); }, [statusFilter, kindFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="hist-root">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="page-label">Opérations · Historique</div>
          <div className="page-title">Historique des dossiers</div>
        </div>
        <button className="btn-outline" onClick={load} disabled={loading}>
          <IconRefresh size={13} />
          Actualiser
        </button>
      </div>

      {/* Barre de filtres */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div className="hist-search">
          <IconSearch size={14} color={AWB.slate400} />
          <input
            className="hist-search-input"
            placeholder="Rechercher (nom, bénéficiaire, #id)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="filter-wrap" style={{ marginLeft: "auto" }} ref={filterRef}>
          <button
            className={`btn-outline filter-btn ${filterOpen ? "active" : ""}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <IconFilter size={14} />
            Filtrer
            {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
          </button>

          {filterOpen && (
            <div className="filter-panel" role="menu">
              <div className="filter-group">
                <div className="filter-group-label">Statut</div>
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`filter-option ${statusFilter === f.id ? "active" : ""}`}
                    onClick={() => setStatusFilter(f.id)}
                  >
                    {f.label}
                    {statusFilter === f.id && <IconCheck size={14} color={AWB.navy} />}
                  </button>
                ))}
              </div>

              <div className="filter-group">
                <div className="filter-group-label">Type</div>
                {KIND_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`filter-option ${kindFilter === f.id ? "active" : ""}`}
                    onClick={() => setKindFilter(f.id)}
                  >
                    {f.label}
                    {kindFilter === f.id && <IconCheck size={14} color={AWB.navy} />}
                  </button>
                ))}
              </div>

              <div className="filter-foot">
                <button
                  className="filter-reset"
                  onClick={() => { setStatusFilter("ALL"); setKindFilter("all"); }}
                  disabled={activeFilters === 0}
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconInbox size={16} />
            {filtered.length} dossier{filtered.length > 1 ? "s" : ""}
          </span>
          {loading && <span className="ai-badge"><span className="ai-dot" /> Chargement</span>}
        </div>

        {error && <div className="error-item">{error}</div>}

        {!loading && filtered.length === 0 && (
          <div className="bo-empty">Aucun dossier ne correspond à ces filtres.</div>
        )}

        <div className="bo-list">
          {pageItems.map((d) => {
            const st = STATUS_META[d.statut] || { cls: "badge-pending", label: d.statut || "—" };
            const who = d.handled_by_user_name || d.created_by_user_name;
            return (
              <button key={`${d.kind}-${d.id}`} className="bo-list-item" onClick={() => setDetail(d)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span className={`modal-kind ${d.kind}`}>{d.kind === "cheque" ? "CHQ" : "KYC"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="bo-list-title">#{d.id} · {dossierTitle(d)}</div>
                    <div className="bo-list-meta">
                      {formatDate(d.updated_at || d.created_at)}{who ? ` · ${who}` : ""}
                    </div>
                  </div>
                </div>
                <span className={`badge ${st.cls}`}>{st.label}</span>
              </button>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="page-nav"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Page précédente"
            >
              <IconChevL size={15} />
            </button>

            {pageWindow(safePage, totalPages).map((n, i) =>
              n === "…" ? (
                <span key={`e-${i}`} className="page-ellipsis">…</span>
              ) : (
                <button
                  key={n}
                  className={`page-btn ${n - 1 === safePage ? "active" : ""}`}
                  onClick={() => setPage(n - 1)}
                >
                  {n}
                </button>
              )
            )}

            <button
              className="page-nav"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Page suivante"
            >
              <IconChevR size={15} />
            </button>
          </div>
        )}
      </div>

      {detail && <DossierDetailModal dossier={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
