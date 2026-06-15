import React, { useCallback, useEffect, useRef, useState } from "react";
import { AWB } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";
import BoxAnnotator from "../components/BoxAnnotator.jsx";

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
const IconCheckCircle = (p) => <Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Icon>;
const IconX = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const IconXCircle = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></Icon>;
const IconAlert = (p) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Icon>;
const IconInfo = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Icon>;
const IconRefresh = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Icon>;
const IconUser = (p) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
const IconSave = (p) => <Icon {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></Icon>;

// Champs corrigeables par le Back Office, groupés par document (= 1 modèle visé).
// L'âge (dérivé) et la signature (détection YOLO, phase 2) restent hors de la correction texte.
const EDITABLE = {
  kyc: [
    { doc: "CIN", title: "CIN", fields: [
      { key: "nom", label: "Nom" },
      { key: "prenom", label: "Prénom" },
      { key: "numero_cin", label: "N° CIN" },
      { key: "date_naissance", label: "Date de naissance" },
      { key: "date_expiration", label: "Date d'expiration" },
    ]},
    { doc: "JUSTIF", title: "Justificatif", fields: [
      { key: "nom", label: "Nom (justificatif)" },
      { key: "adresse", label: "Adresse" },
      { key: "sous_type", label: "Type de document" },
    ]},
  ],
  cheque: [
    { doc: "CHEQUE", title: "Chèque", fields: [
      { key: "montant_chiffre", label: "Montant (chiffres)" },
      { key: "montant_lettre", label: "Montant (lettres)" },
      { key: "beneficiaire", label: "Bénéficiaire" },
      { key: "num_compte", label: "N° de compte" },
      { key: "cmc7", label: "Bande CMC7" },
    ]},
  ],
};

// Pré-remplit le brouillon de correction depuis l'analyse IA (valeurs extraites).
function initDraft(kind, analysis) {
  const ex = analysis?.extracted || {};
  const justif = analysis?.extracted_justif || {};
  const draft = {};
  for (const grp of EDITABLE[kind] || []) {
    const src = (kind === "kyc" && grp.doc === "JUSTIF") ? justif : ex;
    draft[grp.doc] = {};
    for (const f of grp.fields) draft[grp.doc][f.key] = src[f.key] ?? "";
  }
  return draft;
}

// ─────────────────────── Types de dossiers traités par le Back Office ───────────────────────
// Chaque "kind" décrit l'API et le rendu propres au domaine (KYC ou Chèque).
const KINDS = {
  kyc: {
    label: "KYC",
    base: "/kyc/dossiers",
    docs: [
      { type: "CIN", label: "Carte Nationale d'Identité" },
      { type: "JUSTIF", label: "Justificatif de Domicile" },
    ],
  },
  cheque: {
    label: "Chèque",
    base: "/cheque/dossiers",
    docs: [
      { type: "CHEQUE", label: "Image du chèque" },
    ],
  },
};

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

function dossierTitle(dossier, kind) {
  if (kind === "cheque") {
    return dossier.beneficiaire || dossier.filename || "Chèque";
  }
  const full = `${dossier.nom || ""} ${dossier.prenom || ""}`.trim();
  return full || "Client non identifié";
}

function dossierMeta(dossier, kind) {
  if (kind === "cheque") {
    const montant = dossier.montant_chiffre ? `${dossier.montant_chiffre}` : "Montant N/A";
    return `${montant} · ${formatDate(dossier.created_at)}`;
  }
  return `CIN ${dossier.cin || "N/A"} · ${formatDate(dossier.created_at)}`;
}

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

// ─────────────────────── DocumentImage (blob fetch, authentifié via api) ───────────────────────
function DocumentImage({ base, dossierId, type, label }) {
  const [url, setUrl] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

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
      .catch(() => {
        if (!revoked) setStatus("error");
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
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

// Classes YOLO annotables par type de document (= clés des boîtes).
const BOX_CLASSES = {
  CIN: ["numero_cin", "nom", "prenom", "date_naissance", "date_expiration"],
  CHEQUE: ["num_compte", "cmc7", "signature"],
};

// Document + annotateur de boîtes (image récupérée en blob, puis overlay SVG).
function AnnotatedDocument({ base, dossierId, type, label, imageSize, initialBoxes, classes, onChange }) {
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
      <div className="bo-doc-label">{label} · corriger la détection</div>
      {status === "loading" && (
        <div className="bo-doc-frame"><span className="skeleton" style={{ width: "100%", height: "100%", display: "block" }} /></div>
      )}
      {status === "error" && (
        <div className="bo-doc-frame bo-doc-empty"><IconAlert size={18} color={AWB.slate400} /><span>Image indisponible</span></div>
      )}
      {status === "ready" && (
        <BoxAnnotator imageUrl={url} imageSize={imageSize} initialBoxes={initialBoxes} classes={classes} onChange={onChange} />
      )}
    </div>
  );
}

function ChecksList({ checks, errors }) {
  return (
    <>
      <div className="card-subtitle">Vérification IA</div>
      <div>
        {Object.values(checks).map((chk, i) => (
          <div key={i} className="check-item">
            <span className="check-label">
              <CheckStatusIcon status={chk.status} />
              {chk.label}
            </span>
            <span className={`check-value ${checkStatusClass(chk.status)}`}>
              {chk.value}
            </span>
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
  );
}

// Panneau ÉDITABLE : l'opérateur corrige les champs extraits (= vérité terrain).
function CorrectionPanel({ kind, draft, onField, checks, errors }) {
  return (
    <>
      <div style={{ fontSize: 11.5, color: AWB.slate500, marginBottom: 12, lineHeight: 1.5 }}>
        Corrigez les champs mal extraits par l'IA, puis enregistrez : ces corrections
        serviront à améliorer le modèle.
      </div>

      {(EDITABLE[kind] || []).map((grp) => (
        <div key={grp.doc}>
          <div className="card-subtitle">Données extraites — {grp.title}</div>
          <div style={{ marginBottom: 14 }}>
            {grp.fields.map((f) => (
              <div className="field-row" key={f.key}>
                <label className="field-label" htmlFor={`corr-${grp.doc}-${f.key}`}>{f.label}</label>
                <div className="field-input-wrap">
                  <input
                    id={`corr-${grp.doc}-${f.key}`}
                    className="field-input"
                    value={draft?.[grp.doc]?.[f.key] ?? ""}
                    onChange={(e) => onField(grp.doc, f.key, e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="divider" style={{ margin: "4px 0 14px" }} />
        </div>
      ))}

      <ChecksList checks={checks} errors={errors} />
    </>
  );
}

export default function BackOfficePage({ selectedUser, focusTarget, forcedKind }) {
  const [kind, setKind] = useState(forcedKind || "kyc"); // "kyc" | "cheque"
  const [dossiers, setDossiers] = useState([]);
  const [selected, setSelected] = useState(null);
  // Id de dossier à sélectionner après le prochain chargement (clic notification).
  const pendingSelectIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [motif, setMotif] = useState("");
  const [draft, setDraft] = useState({});
  const [boxesDraft, setBoxesDraft] = useState({}); // { docType: { classe: [x1,y1,x2,y2] } }
  const [corrSaving, setCorrSaving] = useState(false);
  const [corrMsg, setCorrMsg] = useState(null);

  const base = KINDS[kind].base;

  const loadEscalated = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(KINDS[kind].base, { params: { statut: "ESCALATED" } });
      const data = res.data;
      setDossiers(data);
      setSelected((current) => {
        // Priorité au dossier ciblé par une notification, sinon on conserve la sélection.
        const targetId = pendingSelectIdRef.current;
        pendingSelectIdRef.current = null;
        if (targetId != null) {
          const found = data.find((d) => d.id === targetId);
          if (found) return found;
        }
        return data.find((d) => d.id === current?.id) || data[0] || null;
      });
    } catch (e) {
      setError(e?.response?.data?.message || "Impossible de charger les dossiers escaladés.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    loadEscalated();
  }, [loadEscalated]);

  // Le domaine est imposé par la page (Back Office KYC ou Chèque) : on s'aligne dessus.
  useEffect(() => {
    if (forcedKind && forcedKind !== kind) setKind(forcedKind);
  }, [forcedKind, kind]);

  // Changement d'onglet : on vide la sélection courante avant le rechargement.
  useEffect(() => {
    setSelected(null);
  }, [kind]);

  // Clic sur une notification : on cible le dossier puis on bascule/recharge l'onglet.
  useEffect(() => {
    if (!focusTarget) return;
    pendingSelectIdRef.current = focusTarget.id;
    if (focusTarget.kind && focusTarget.kind !== kind) {
      setKind(focusTarget.kind); // déclenche le rechargement via la dépendance [kind]
    } else {
      loadEscalated(); // même onglet : on force un rechargement pour cibler le dossier
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  // Réinitialise le commentaire ET le brouillon de correction à chaque
  // changement de dossier (ou d'onglet KYC/Chèque).
  useEffect(() => {
    setMotif("");
    setCorrMsg(null);
    setDraft(selected ? initDraft(kind, selected.analysis) : {});
    // Boîtes initiales = celles prédites par YOLO (l'opérateur les ajuste).
    setBoxesDraft(selected ? (selected.analysis?.boxes || {}) : {});
  }, [selected?.id, kind]);

  const onField = (doc, key, value) =>
    setDraft((prev) => ({ ...prev, [doc]: { ...prev[doc], [key]: value } }));

  const onBoxesChange = (docType, newBoxes) =>
    setBoxesDraft((prev) => ({ ...prev, [docType]: newBoxes }));

  const saveCorrections = async () => {
    if (!selected) return;
    setCorrSaving(true);
    setCorrMsg(null);
    setError(null);
    try {
      const res = await api.post(`${base}/${selected.id}/corrections`, { documents: draft, boxes: boxesDraft });
      setCorrMsg(`Corrections enregistrées (${res.data?.count ?? 0} document(s)).`);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || "Corrections non enregistrées.");
    } finally {
      setCorrSaving(false);
    }
  };

  const decide = async (action) => {
    if (!selected) return;

    const trimmed = motif.trim();
    if (action === "rejeter" && !trimmed) {
      setError("Le motif de rejet est obligatoire.");
      return;
    }

    const payloadMotif = trimmed || (action === "approuver" ? "Traitement manuel Back Office" : null);

    setActionLoading(true);
    setError(null);
    try {
      await api.patch(`${base}/${selected.id}/${action}`, { motif: payloadMotif });
      setMotif("");
      await loadEscalated();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || "Décision non enregistrée.");
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

      {/* Sélecteur de domaine : masqué lorsque la page impose déjà KYC ou Chèque */}
      {!forcedKind && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          {Object.entries(KINDS).map(([id, cfg]) => (
            <div
              key={id}
              className={`tab ${kind === id ? "active" : ""}`}
              onClick={() => setKind(id)}
            >
              {cfg.label}
            </div>
          ))}
        </div>
      )}

      <div className="bo-grid">
        <div className="card bo-list-card">
          <div className="card-title" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconInbox size={16} />
              File Back Office · {KINDS[kind].label}
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
                  <div className="bo-list-title">#{dossier.id} · {dossierTitle(dossier, kind)}</div>
                  <div className="bo-list-meta">{dossierMeta(dossier, kind)}</div>
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
                <span>{KINDS[kind].label} #{selected.id} · Vérification manuelle</span>
                <span className="badge badge-info">Back Office</span>
              </div>

              {selected.escalated_by_user_name && (
                <div className="bo-escalated-by">
                  <IconUser size={13} />
                  Escaladé par {selected.escalated_by_user_name} ({selected.escalated_by_role === "BACK_OFFICE" ? "Back Office" : "Front Office"})
                </div>
              )}

              {/* Split-pane : documents (gauche) · analyse IA front-office (droite) */}
              <div className="bo-verify-grid">
                <div className="bo-verify-docs">
                  <div className="card-subtitle">Documents originaux</div>
                  {selected.has_documents ? (
                    KINDS[kind].docs.map((doc) => (
                      BOX_CLASSES[doc.type] ? (
                        <AnnotatedDocument
                          key={doc.type}
                          base={base}
                          dossierId={selected.id}
                          type={doc.type}
                          label={doc.label}
                          imageSize={selected.analysis?.image_sizes?.[doc.type]}
                          initialBoxes={selected.analysis?.boxes?.[doc.type]}
                          classes={BOX_CLASSES[doc.type]}
                          onChange={(nb) => onBoxesChange(doc.type, nb)}
                        />
                      ) : (
                        <DocumentImage
                          key={doc.type}
                          base={base}
                          dossierId={selected.id}
                          type={doc.type}
                          label={doc.label}
                        />
                      )
                    ))
                  ) : (
                    <div className="bo-doc-frame bo-doc-empty">
                      <IconAlert size={18} color={AWB.slate400} />
                      <span>Documents non conservés</span>
                    </div>
                  )}
                </div>

                <div className="bo-verify-data">
                  <CorrectionPanel
                    kind={kind}
                    draft={draft}
                    onField={onField}
                    checks={selected.analysis?.checks || {}}
                    errors={selected.analysis?.errors || []}
                  />
                </div>
              </div>

              {/* Enregistrement des corrections (human-in-the-loop) */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                <button className="btn-outline" onClick={saveCorrections} disabled={corrSaving}>
                  {corrSaving ? <div className="spinner" /> : <IconSave size={13} />}
                  Enregistrer les corrections
                </button>
                {corrMsg && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: AWB.success }}>
                    <IconCheck size={13} color={AWB.success} />
                    {corrMsg}
                  </span>
                )}
              </div>

              <div className="bo-detail-grid" style={{ marginTop: 16 }}>
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

              <div className="field-row">
                <label className="field-label" htmlFor="bo-motif">
                  Commentaire / motif Back Office
                  <span style={{ color: AWB.slate400, fontWeight: 400 }}> · requis pour un rejet</span>
                </label>
                <textarea
                  id="bo-motif"
                  className="field-input bo-motif"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Saisissez le motif de la décision…"
                  rows={3}
                />
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
