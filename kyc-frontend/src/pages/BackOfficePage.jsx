import React, { useCallback, useEffect, useState } from "react";
import { AWB, API_BASE } from "../constants/Theme.jsx";

const Icon = ({ children, size = 16, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
       aria-hidden="true">
    {children}
  </svg>
);

const IconInbox = (p) => <Icon {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Icon>;
const IconCheck = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
const IconX = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const IconRefresh = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Icon>;

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function clientName(dossier) {
  const full = `${dossier.nom || ""} ${dossier.prenom || ""}`.trim();
  return full || "Client non identifié";
}

export default function BackOfficePage({ selectedUser }) {
  const [dossiers, setDossiers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadEscalated = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/kyc/dossiers?statut=ESCALATED`);
      if (!res.ok) throw new Error("Impossible de charger les dossiers escaladés.");
      const data = await res.json();
      setDossiers(data);
      setSelected((current) => data.find((d) => d.id === current?.id) || data[0] || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEscalated();
  }, [loadEscalated]);

  const decide = async (action) => {
    if (!selected) return;
    const motif = action === "rejeter"
      ? prompt("Motif du rejet Back Office (obligatoire) :")
      : prompt("Commentaire Back Office :", "Traitement manuel Back Office");

    if (action === "rejeter" && !motif) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kyc/dossiers/${selected.id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif, actorRole: "BACK_OFFICE", actorUserId: selectedUser?.id ?? null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Décision non enregistrée.");
      }
      await loadEscalated();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bo-root">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="page-label">Back Office · Traitement manuel</div>
          <div className="page-title">Dossiers Escaladés</div>
        </div>
        <button className="btn-outline" onClick={loadEscalated} disabled={loading}>
          <IconRefresh size={13} />
          Actualiser
        </button>
      </div>

      <div className="bo-grid">
        <div className="card bo-list-card">
          <div className="card-title" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconInbox size={16} />
              File Back Office
            </span>
            <span className="badge badge-pending">{dossiers.length} en attente</span>
          </div>

          {error && <div className="error-item">{error}</div>}
          {loading && <div className="ai-badge"><span className="ai-dot" /> Chargement</div>}

          {!loading && dossiers.length === 0 && (
            <div className="bo-empty">Aucun dossier escaladé à traiter.</div>
          )}

          <div className="bo-list">
            {dossiers.map((dossier) => (
              <button
                key={dossier.id}
                className={`bo-list-item ${selected?.id === dossier.id ? "active" : ""}`}
                onClick={() => setSelected(dossier)}
              >
                <div>
                  <div className="bo-list-title">#{dossier.id} · {clientName(dossier)}</div>
                  <div className="bo-list-meta">CIN {dossier.cin || "N/A"} · {formatDate(dossier.created_at)}</div>
                </div>
                <span className="badge badge-info">Escaladé</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card bo-detail-card">
          {!selected ? (
            <div className="bo-empty">Sélectionnez un dossier pour voir le détail.</div>
          ) : (
            <>
              <div className="card-title" style={{ justifyContent: "space-between" }}>
                <span>Dossier #{selected.id}</span>
                <span className="badge badge-info">Back Office</span>
              </div>

              <div className="bo-detail-grid">
                <div className="field-row">
                  <label className="field-label">Client</label>
                  <div className="field-input">{clientName(selected)}</div>
                </div>
                <div className="field-row">
                  <label className="field-label">N° CIN</label>
                  <div className="field-input">{selected.cin || "N/A"}</div>
                </div>
                <div className="field-row">
                  <label className="field-label">Décision IA</label>
                  <div className="field-input">{selected.decision_ia || "N/A"}</div>
                </div>
                <div className="field-row">
                  <label className="field-label">Score risque</label>
                  <div className="field-input">{selected.risk_score ?? "N/A"}</div>
                </div>
              </div>

              <div className="field-row">
                <label className="field-label">Motif d'escalade</label>
                <div className="agent-report">{selected.motif || "Escaladé pour révision manuelle"}</div>
              </div>

              <div className="field-row">
                <label className="field-label">Rapport IA</label>
                <div className="agent-report">{selected.agent_report || "Aucun rapport disponible."}</div>
              </div>

              <div className="action-bar">
                <button className="btn-reject" onClick={() => decide("rejeter")} disabled={actionLoading}>
                  <IconX size={13} />
                  Rejeter
                </button>
                <button className="btn-approve" onClick={() => decide("approuver")} disabled={actionLoading} style={{ marginLeft: "auto" }}>
                  <IconCheck size={13} />
                  Approuver manuellement
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
