import React, { useEffect, useState } from "react";
import { AWB } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";

const Icon = ({ children, size = 16, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconX            = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const IconAlert        = (p) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Icon>;
const IconCheckCircle  = (p) => <Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Icon>;
const IconXCircle      = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></Icon>;
const IconInfo         = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Icon>;

const STATUS_META = {
  PENDING:   { cls: "badge-pending",  label: "En attente" },
  APPROVED:  { cls: "badge-approved", label: "Approuvé" },
  REJECTED:  { cls: "badge-rejected", label: "Rejeté" },
  ESCALATED: { cls: "badge-info",     label: "Escaladé" },
};

const DOCS_BY_KIND = {
  kyc: {
    base: "/kyc/dossiers",
    docs: [
      { type: "CIN", label: "Carte Nationale d'Identité" },
      { type: "JUSTIF", label: "Justificatif de Domicile" },
    ],
  },
  cheque: {
    base: "/cheque/dossiers",
    docs: [{ type: "CHEQUE", label: "Image du chèque" }],
  },
};

function CheckStatusIcon({ status, size = 14 }) {
  if (status === "success") return <IconCheckCircle size={size} color={AWB.success} />;
  if (status === "error")   return <IconXCircle size={size} color={AWB.danger} />;
  if (status === "warning") return <IconAlert size={size} color={AWB.warning} />;
  return <IconInfo size={size} color={AWB.info} />;
}

function checkStatusClass(status) {
  return status === "success" ? "check-ok"
    : status === "error"   ? "check-error"
    : status === "warning" ? "check-warning"
    : "check-info";
}

function Field({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="field-row">
      <label className="field-label">{label}</label>
      <div className="field-input">{String(value)}</div>
    </div>
  );
}

// Image d'un document, récupérée en blob via api (authentifié).
function DocImage({ base, dossierId, type, label }) {
  const [url, setUrl] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    setStatus("loading");
    setUrl(null);
    api.get(`${base}/${dossierId}/documents/${type}`, { responseType: "blob" })
      .then((res) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
        setStatus("ready");
      })
      .catch(() => { if (!revoked) setStatus("error"); });
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [base, dossierId, type]);

  return (
    <div className="bo-doc">
      <div className="bo-doc-label">{label}</div>
      {status === "loading" && (
        <div className="bo-doc-frame">
          <span className="skeleton" style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
      )}
      {status === "error" && (
        <div className="bo-doc-frame bo-doc-empty">
          <IconAlert size={18} color={AWB.slate400} />
          <span>Image indisponible</span>
        </div>
      )}
      {status === "ready" && (
        <a href={url} target="_blank" rel="noreferrer" className="bo-doc-frame" title="Ouvrir en grand">
          <img src={url} alt={label} />
        </a>
      )}
    </div>
  );
}

function ExtractedBlock({ dossier }) {
  const analysis = dossier.analysis || {};
  const ex = analysis.extracted || {};

  if (dossier.kind === "cheque") {
    return (
      <>
        <Field label="Montant (chiffres)" value={ex.montant_chiffre} />
        <Field label="Montant (lettres)" value={ex.montant_lettre} />
        <Field label="Bénéficiaire" value={ex.beneficiaire} />
        <Field label="N° de compte" value={ex.num_compte} />
        <Field label="Bande CMC7" value={ex.cmc7} />
        <Field label="Signature" value={ex.signature_present == null ? null : (ex.signature_present ? "Présente" : "Absente")} />
      </>
    );
  }

  const justif = analysis.extracted_justif || {};
  return (
    <>
      <div className="card-subtitle">CIN</div>
      <Field label="Nom" value={ex.nom} />
      <Field label="Prénom" value={ex.prenom} />
      <Field label="N° CIN" value={ex.numero_cin} />
      <Field label="Date de naissance" value={ex.date_naissance} />
      <Field label="Date d'expiration" value={ex.date_expiration} />
      <Field label="Âge calculé" value={ex.age != null ? `${ex.age} ans` : null} />
      <div className="divider" style={{ margin: "12px 0" }} />
      <div className="card-subtitle">Justificatif</div>
      <Field label="Nom (justificatif)" value={justif.nom} />
      <Field label="Adresse" value={justif.adresse} />
      <Field label="Type de document" value={justif.sous_type} />
    </>
  );
}

export default function DossierDetailModal({ dossier, onClose }) {
  // Ferme sur Échap.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!dossier) return null;

  const kindCfg = DOCS_BY_KIND[dossier.kind] || DOCS_BY_KIND.kyc;
  const analysis = dossier.analysis || {};
  const checks = analysis.checks || {};
  const errors = analysis.errors || [];
  const st = STATUS_META[dossier.statut] || { cls: "badge-pending", label: dossier.statut || "—" };

  const title = dossier.kind === "cheque"
    ? (dossier.beneficiaire || `Chèque #${dossier.id}`)
    : (`${dossier.nom || ""} ${dossier.prenom || ""}`.trim() || `Dossier #${dossier.id}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <span className={`modal-kind ${dossier.kind}`}>{dossier.kind === "cheque" ? "CHÈQUE" : "KYC"}</span>
          <div className="modal-title">#{dossier.id} · {title}</div>
          <span className={`badge ${st.cls}`} style={{ fontSize: 11, padding: "4px 10px" }}>{st.label}</span>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            <IconX size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Documents */}
          <div className="card-subtitle">Documents originaux</div>
          {dossier.has_documents ? (
            <div className="modal-docs">
              {kindCfg.docs.map((doc) => (
                <DocImage
                  key={doc.type}
                  base={kindCfg.base}
                  dossierId={dossier.id}
                  type={doc.type}
                  label={doc.label}
                />
              ))}
            </div>
          ) : (
            <div className="bo-doc-frame bo-doc-empty" style={{ marginBottom: 16 }}>
              <IconAlert size={18} color={AWB.slate400} />
              <span>Documents non conservés (décision finale rendue)</span>
            </div>
          )}

          <div className="divider" />

          {/* Données extraites */}
          <div className="card-subtitle">Données extraites</div>
          <div style={{ marginBottom: 14 }}>
            <ExtractedBlock dossier={dossier} />
          </div>

          {/* Vérification IA */}
          {Object.keys(checks).length > 0 && (
            <>
              <div className="divider" />
              <div className="card-subtitle">Vérification IA</div>
              <div>
                {Object.values(checks).map((chk, i) => (
                  <div key={i} className="check-item">
                    <span className="check-label">
                      <CheckStatusIcon status={chk.status} />
                      {chk.label}
                    </span>
                    <span className={`check-value ${checkStatusClass(chk.status)}`}>{chk.value}</span>
                  </div>
                ))}
              </div>
              {errors.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {errors.map((e, i) => (
                    <div key={i} className="error-item">
                      <IconAlert size={14} />
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="divider" />

          {/* Décision / synthèse */}
          <div className="bo-detail-grid">
            <Field label="Décision IA" value={dossier.decision_ia || "N/A"} />
            <Field label="Score risque" value={dossier.risk_score ?? "N/A"} />
          </div>
          {dossier.motif && <Field label="Motif" value={dossier.motif} />}

          <div className="card-subtitle" style={{ marginTop: 8 }}>Compte-rendu de l'Agent</div>
          <div className="agent-report">{dossier.agent_report || "Aucun rapport disponible."}</div>
        </div>
      </div>
    </div>
  );
}
