import React, { useState, useRef, useCallback, useEffect } from "react";
import { AWB } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";

// ─────────────────────── Persistent state helper ───────────────────────
const STORAGE_KEY = "awb.cheque.state.v1";

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePersisted(partial) {
  try {
    const current = readPersisted() || {};
    const next = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("Cheque state persist failed:", e?.message);
  }
}

function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const STEPS = [
  ["1", "Document"],
  ["2", "Analyse IA"],
  ["3", "Décision"],
];

const LOADING_STEPS = [
  "Lecture du manuscrit (VLM)",
  "Détection des zones (YOLO)",
  "Validation & compte-rendu de l'Agent",
];

// ─────────────────────── Inline SVG icons (Lucide-style, 1.75 stroke) ───────────────────────
const Icon = ({ children, size = 16, color = "currentColor", className = "", style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const IconCheck         = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
const IconCheckCircle   = (p) => <Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Icon>;
const IconX             = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const IconXCircle       = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></Icon>;
const IconAlert         = (p) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Icon>;
const IconInfo          = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Icon>;
const IconUpload        = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Icon>;
const IconFileText      = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></Icon>;
const IconShieldCheck   = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></Icon>;
const IconClipboardList = (p) => <Icon {...p}><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><line x1="12" y1="11" x2="16" y2="11" /><line x1="12" y1="16" x2="16" y2="16" /><line x1="8" y1="11" x2="8.01" y2="11" /><line x1="8" y1="16" x2="8.01" y2="16" /></Icon>;
const IconScale         = (p) => <Icon {...p}><path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" /><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></Icon>;
const IconCpu           = (p) => <Icon {...p}><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></Icon>;
const IconArrowUp       = (p) => <Icon {...p}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></Icon>;
const IconRotate        = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></Icon>;

// ─────────────────────── Helpers ───────────────────────
function stepState(current, target) {
  if (current > target) return "done";
  if (current === target) return "active";
  return "idle";
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

// ─────────────────────── StepsBar ───────────────────────
function StepsBar({ step }) {
  return (
    <div className="steps-bar">
      {STEPS.map(([n, lbl], i) => {
        const state = stepState(step, i + 1);
        return (
          <div key={i} className="step-item">
            <div className={`step-circle ${state}`}>
              {step > i + 1 ? <IconCheck size={13} /> : n}
            </div>
            <span className={`step-label ${state}`}>{lbl}</span>
            {i < STEPS.length - 1 && (
              <div className={`step-line ${step > i + 1 ? "done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────── Collapsed strip (shown after analysis) ───────────────────────
function DocCollapsed({ file, preview, onResetAll }) {
  return (
    <div className="card compact">
      <div className="card-title" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconFileText size={16} />
          Chèque analysé
        </span>
        <button className="btn-outline" onClick={onResetAll} style={{ padding: "4px 10px", fontSize: 11 }}>
          <IconRotate size={12} />
          Nouveau chèque
        </button>
      </div>
      <div className="docs-strip">
        <div className="doc-thumb-row">
          <img src={preview} alt="Chèque" className="doc-thumb" />
          <div className="doc-thumb-info">
            <div className="doc-thumb-label">Chèque</div>
            <div className="doc-thumb-name">{file?.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── UploadCard ───────────────────────
function UploadCard({
  file, preview, dragging, loading, error,
  handleFile, onAnalyze, onReset, fileInput, setDragging,
}) {
  return (
    <div className="card">
      <div className="card-title">
        <IconFileText size={16} />
        Document Chèque
      </div>

      <div className="upload-slot" style={{ marginTop: 8 }}>
        <div className="card-subtitle">Image du chèque (recto)</div>

        {preview ? (
          <div className="doc-preview">
            <img src={preview} alt="Chèque" />
          </div>
        ) : (
          <div
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            onClick={() => fileInput.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <div className="upload-icon-wrap">
              <IconUpload size={20} />
            </div>
            <div className="upload-text">Chargez le chèque</div>
            <div className="upload-sub">Recto · JPG, PNG</div>
            <input
              ref={fileInput}
              type="file"
              accept=".jpg,.jpeg,.png"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {file && (
          <div className="file-meta">
            <span className="chip" title={file.name}>
              <IconFileText size={11} />
              <span className="chip-name">{file.name}</span>
            </span>
            <button
              className="btn-outline btn-icon"
              onClick={onReset}
              aria-label="Retirer le chèque"
            >
              <IconX size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="action-bar" style={{ marginTop: 22 }}>
        <button
          className="btn-primary"
          onClick={onAnalyze}
          disabled={!file || loading}
          style={{ flex: 1 }}
        >
          {loading ? (
            <>
              <div className="spinner" />
              Analyse en cours
            </>
          ) : (
            <>
              <IconShieldCheck size={15} color="currentColor" />
              {file ? "Lancer l'Analyse Chèque" : "Lancer l'Analyse · 1 document requis"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="error-item" style={{ marginTop: 14 }}>
          <IconAlert size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── ExtractedDataCard (editable inputs) ───────────────────────
function ExtractedDataCard({ extracted }) {
  const [draft, setDraft] = useState({});

  useEffect(() => { setDraft(extracted || {}); }, [extracted]);

  const fields = [
    { key: "montant_chiffre", label: "Montant (chiffres)" },
    { key: "montant_lettre",  label: "Montant (lettres)" },
    { key: "beneficiaire",    label: "Bénéficiaire" },
    { key: "num_compte",      label: "N° de compte" },
    { key: "cmc7",            label: "Bande CMC7" },
  ];

  const renderField = (field) => {
    const raw = draft?.[field.key];
    const value = raw == null ? "" : String(raw);
    return (
      <div className="field-row" key={field.key}>
        <label className="field-label" htmlFor={`f-${field.key}`}>{field.label}</label>
        <div className="field-input-wrap">
          <input
            id={`f-${field.key}`}
            className="field-input"
            value={value}
            placeholder="Illisible — à corriger"
            onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
            spellCheck={false}
          />
        </div>
      </div>
    );
  };

  const signaturePresent = !!draft?.signature_present;

  return (
    <div className="card card-fill">
      <div className="card-title">
        <IconClipboardList size={16} />
        Données Extraites
      </div>

      <div className="card-body-scroll">
        <div className="card-subtitle">Champs manuscrits & zones</div>
        <div>
          {fields.map(renderField)}

          {/* Signature : indicateur non éditable (présence détectée par YOLO) */}
          <div className="field-row">
            <label className="field-label">Signature</label>
            <div className="check-item" style={{ borderBottom: "none", padding: 0 }}>
              <span className={`check-value ${signaturePresent ? "check-ok" : "check-error"}`}>
                <CheckStatusIcon status={signaturePresent ? "success" : "error"} />
                {signaturePresent ? "Présente" : "Absente"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── VerificationCard ───────────────────────
function VerificationCard({ checks, errors }) {
  return (
    <div className="card card-fill">
      <div className="card-title" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCpu size={16} />
          Vérification IA
        </span>
        <span className="ai-badge">
          <span className="ai-dot" />
          Pipeline chèque
        </span>
      </div>

      <div className="card-body-scroll">
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

        {errors?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {errors.map((e, i) => (
              <div key={i} className="error-item">
                <IconAlert size={14} />
                <span>{e}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────── DecisionCard ───────────────────────
function DecisionCard({ result, dossierId, statutDecision, setStatutDecision }) {
  const [loadingAction, setLoadingAction] = useState(false);

  const callDecision = async (action, motif = null) => {
    if (!dossierId) return;
    setLoadingAction(true);
    try {
      await api.patch(`/cheque/dossiers/${dossierId}/${action}`, { motif });
      setStatutDecision(action);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRejeter = () => {
    const motif = prompt("Motif du rejet (obligatoire) :");
    if (!motif) return;
    callDecision("rejeter", motif);
  };

  const renderBadge = (label, kind, IconComp) => (
    <span className={`badge ${kind}`} style={{ fontSize: 12, padding: "6px 12px" }}>
      <IconComp size={13} />
      {label}
    </span>
  );

  const statutBadge = {
    approuver: renderBadge("Chèque approuvé", "badge-approved", IconCheckCircle),
    rejeter:   renderBadge("Chèque rejeté",   "badge-rejected", IconXCircle),
    escalader: renderBadge("Chèque escaladé", "badge-pending",  IconArrowUp),
  };

  // Décision IA : VALIDE → approuvé, REJETE → rejeté, sinon à vérifier (pending).
  const iaDecision = (result.decision || "").toUpperCase();
  const iaBadge = iaDecision.includes("VALIDE")
    ? renderBadge("IA : Valide", "badge-approved", IconCheckCircle)
    : iaDecision.includes("REJET")
      ? renderBadge("IA : Rejeté", "badge-rejected", IconXCircle)
      : renderBadge("IA : À vérifier", "badge-pending", IconAlert);

  return (
    <div className="card">
      <div className="card-title">
        <IconScale size={16} />
        Décision Chèque
      </div>

      <div style={{ marginBottom: 18 }}>
        {statutDecision ? statutBadge[statutDecision] : iaBadge}
      </div>

      <div className="card-subtitle">Compte-rendu de l'Agent</div>
      <div className="agent-report">{result.agent_report}</div>

      {!statutDecision && (
        <div className="action-bar">
          <button className="btn-reject" onClick={handleRejeter} disabled={loadingAction}>
            <IconX size={13} />
            Rejeter
          </button>
          <button
            className="btn-escalate"
            onClick={() => callDecision("escalader")}
            disabled={loadingAction}
            style={{ marginLeft: "auto" }}
          >
            {loadingAction ? <div className="spinner" /> : <IconArrowUp size={13} />}
            Escalader
          </button>
        </div>
      )}

      {statutDecision && (
        <div style={{
          marginTop: 16, fontSize: 12, color: AWB.slate500,
          textAlign: "center", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <IconCheck size={13} color={AWB.success} />
          Décision enregistrée en base de données
        </div>
      )}
    </div>
  );
}

// ─────────────────────── LoadingCard (shimmer skeleton) ───────────────────────
function LoadingCard() {
  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCpu size={16} />
          Analyse en cours
        </span>
        <span className="ai-badge">
          <span className="ai-dot" />
          Traitement
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span className="skeleton skeleton-line" style={{ width: "70%" }} />
        <span className="skeleton skeleton-line" style={{ width: "92%" }} />
        <span className="skeleton skeleton-line" style={{ width: "60%" }} />
        <span className="skeleton skeleton-line" style={{ width: "85%" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LOADING_STEPS.map((s, i) => (
          <div
            key={i}
            className="pulse"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 12, color: AWB.slate600,
              padding: "6px 0",
              animationDelay: `${i * 0.25}s`,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: AWB.gold, flexShrink: 0,
            }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────── AI Empty State ───────────────────────
function AIEmptyState() {
  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCpu size={16} />
          Agent Analyste Chèque
        </span>
        <span className="ai-badge">
          <span className="ai-dot" />
          En attente
        </span>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "12px 8px 4px", gap: 12,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: AWB.slate50, border: `1px solid ${AWB.slate200}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: AWB.slate400,
        }}>
          <IconShieldCheck size={24} />
        </div>
        <div style={{ fontSize: 12.5, color: AWB.slate600, lineHeight: 1.6, maxWidth: 320 }}>
          Chargez l'image du chèque puis lancez l'analyse pour obtenir
          l'extraction des montants, du bénéficiaire, la détection de la
          signature/CMC7 et le compte-rendu de l'Agent Chèque.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Main ChequePage ───────────────────────
export default function ChequePage({ userRole = "FRONT_OFFICE", selectedUser }) {
  const initial = readPersisted() || {};

  const [file, setFile]         = useState(() =>
    initial.fileMeta ? { name: initial.fileMeta.name, size: initial.fileMeta.size } : null
  );
  const [preview, setPreview]   = useState(initial.preview || null);
  const [dragging, setDragging] = useState(false);
  const fileInput               = useRef();

  const [loading, setLoading]               = useState(false);
  const [step, setStep]                     = useState(initial.step ?? 0);
  const [result, setResult]                 = useState(initial.result || null);
  const [error, setError]                   = useState(null);
  const [dossierId, setDossierId]           = useState(initial.dossierId || null);
  const [statutDecision, setStatutDecision] = useState(initial.statutDecision || null);

  useEffect(() => {
    writePersisted({ step, result, dossierId, statutDecision });
  }, [step, result, dossierId, statutDecision]);

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    const dataURL = await readFileAsDataURL(f).catch(() => null);
    setPreview(dataURL);
    setStep(1);
    setResult(null);
    setError(null);
    writePersisted({
      fileMeta: { name: f.name, size: f.size },
      preview: dataURL,
      result: null,
      statutDecision: null,
    });
  }, []);

  const analyze = async () => {
    // Le fichier doit être une vraie instance File — pas des métadonnées restaurées.
    if (!(file instanceof File)) {
      setError("Veuillez recharger le chèque pour relancer l'analyse.");
      return;
    }
    setLoading(true);
    setStep(2);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(`/cheque/analyze`, formData);
      const data = res.data;
      setResult(data);
      setDossierId(data.dossier_id);
      setStep(3);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || e.message || "Erreur serveur";
      setError(msg);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setStep(0);
    setResult(null);
    setError(null);
    setStatutDecision(null);
    writePersisted({ fileMeta: null, preview: null, result: null, statutDecision: null });
  };

  const resetAll = () => {
    setFile(null); setPreview(null);
    setResult(null); setError(null);
    setStatutDecision(null); setDossierId(null);
    setStep(0);
    clearPersisted();
  };

  const checks    = result?.checks    || {};
  const extracted = result?.extracted || {};

  return (
    <div className="kyc-root">
      <div className="kyc-page">
        <div className="page-header compact">
          <div className="page-label">Opérations · Chèque</div>
          <div className="page-title">Vérification de Chèque</div>
        </div>

        <StepsBar step={step} />

        <div className="kyc-grid">
          {/* ── Left column ── */}
          <div className="col-stack">
            {!result ? (
              <UploadCard
                file={file}
                preview={preview}
                dragging={dragging}
                loading={loading}
                error={error}
                handleFile={handleFile}
                onAnalyze={analyze}
                onReset={reset}
                fileInput={fileInput}
                setDragging={setDragging}
              />
            ) : (
              <>
                <DocCollapsed file={file} preview={preview} onResetAll={resetAll} />
                <div className="col-fill">
                  <ExtractedDataCard extracted={extracted} />
                </div>
              </>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="col-stack">
            {!result && !loading && <div className="col-fill"><AIEmptyState /></div>}
            {loading && <div className="col-fill"><LoadingCard /></div>}
            {result && (
              <>
                <div className="col-fill">
                  <VerificationCard checks={checks} errors={result.errors} />
                </div>
                <DecisionCard
                  result={result}
                  dossierId={dossierId}
                  statutDecision={statutDecision}
                  setStatutDecision={setStatutDecision}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
