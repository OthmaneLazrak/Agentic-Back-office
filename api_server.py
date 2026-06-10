"""
api_server.py — Python Agent Server (FastAPI)

Couche "Python Agent Server" de l'architecture cible :

    Frontend -> Spring Boot -> AI Orchestrator (Spring) -> Python Agent Server (ce fichier)
                                                              |
                                                              v
                                                   LangGraph Agent (kyc_agent)
                                                              |
                                                              v
                                                   MCP Tools / Models (SSE)

Expose un endpoint HTTP unique consommé par AiOrchestratorService côté Spring.
La persistance (Postgres), les workflows métier et les règles de sécurité
restent côté Spring : ce service ne fait que de l'inférence.

Lancement local :
    uvicorn api_server:app --host 0.0.0.0 --port 8500
"""

import asyncio
import os
import shutil
import sys
import tempfile
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator_agent.agent import analyser_kyc, analyser_cheque, analyser_auto


ACCEPTED_MIME_TYPES = {"image/jpeg", "image/png", "image/jpg"}
UPLOAD_DIR = os.environ.get("KYC_AGENT_UPLOAD_DIR", os.path.join(tempfile.gettempdir(), "kyc_agent_uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


app = FastAPI(
    title="AWB KYC — Python Agent Server",
    version="2.0.0",
    description="Inference-only HTTP layer wrapping the LangGraph KYC agent + MCP tools.",
)

# CORS large : ce service est censé n'être appelé que par Spring (réseau interne),
# mais on autorise quand même les origines front pour faciliter le debug local.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "KYC_AGENT_CORS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health() -> Dict[str, str]:
    return {
        "status": "ok",
        "service": "kyc-python-agent",
        "mcp_transport": os.environ.get("KYC_MCP_TRANSPORT", "stdio"),
        "mcp_url": os.environ.get("KYC_MCP_URL", ""),
        "agent_model": os.environ.get("KYC_AGENT_MODEL", "qwen2.5:3b"),
        "report_mode": os.environ.get("KYC_AGENT_REPORT_MODE", "llm"),
    }


def _save_upload(upload: UploadFile, prefix: str) -> str:
    if upload.content_type not in ACCEPTED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"{prefix}: format non supporté ({upload.content_type}).")
    safe_name = os.path.basename(upload.filename or "document")
    target = os.path.join(UPLOAD_DIR, f"{prefix}_{os.getpid()}_{safe_name}")
    with open(target, "wb") as fh:
        shutil.copyfileobj(upload.file, fh)
    return target


def _cleanup(*paths: str) -> None:
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except OSError as exc:
            print(f"[agent] cleanup error {path}: {exc}", file=sys.stderr)


@app.post("/agent/analyze")
async def analyze(
    file: UploadFile = File(..., description="Image CIN (recto)"),
    justif: UploadFile = File(..., description="Justificatif de domicile"),
) -> JSONResponse:
    """Pipeline complet d'analyse KYC orchestré par le LangGraph agent.

    Le scoring de risque, la persistance Postgres et le mapping final
    pour le front sont délégués à Spring : on renvoie ici le payload brut
    produit par l'agent (donnees_cin, donnees_justif, validation*, agent_text).
    """
    cin_path = justif_path = None
    try:
        cin_path = _save_upload(file, prefix="cin")
        justif_path = _save_upload(justif, prefix="justif")

        try:
            payload: Dict[str, Any] = await analyser_kyc(cin_path, justif_path)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[agent] erreur pipeline: {exc}", file=sys.stderr)
            raise HTTPException(status_code=500, detail=f"Echec pipeline KYC: {exc}") from exc

        return JSONResponse(payload)
    finally:
        _cleanup(cin_path, justif_path)


@app.post("/cheque/analyze")
async def analyze_cheque(
    file: UploadFile = File(..., description="Image du chèque"),
) -> JSONResponse:
    """Pipeline complet d'analyse de chèque orchestré par le LangGraph agent.

    Mono-document (contrairement au KYC qui prend CIN + justificatif).
    Le scoring de risque, la persistance Postgres et le mapping final pour le
    front sont délégués à Spring : on renvoie ici le payload brut produit par
    l'agent (donnees_manuscrit, donnees_zones, validation, agent_text).
    """
    cheque_path = None
    try:
        cheque_path = _save_upload(file, prefix="cheque")

        try:
            payload: Dict[str, Any] = await analyser_cheque(cheque_path)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[agent] erreur pipeline chèque: {exc}", file=sys.stderr)
            raise HTTPException(status_code=500, detail=f"Echec pipeline chèque: {exc}") from exc

        return JSONResponse(payload)
    finally:
        _cleanup(cheque_path)


@app.post("/orchestrator/analyze")
async def analyze_orchestrated(
    file: UploadFile = File(..., description="Document principal (CIN ou chèque)"),
    justif: UploadFile = File(None, description="Justificatif de domicile (optionnel, dossier KYC)"),
    hint: str = "",
) -> JSONResponse:
    """Point d'entrée « l'orchestrateur décide ».

    L'agent orchestrateur classe la demande (KYC vs chèque) via le LLM, libère la
    VRAM de l'autre domaine, puis délègue à l'agent spécialisé. Renvoie le payload
    de l'agent choisi, enrichi de la clé ``route``.
    """
    main_path = justif_path = None
    try:
        main_path = _save_upload(file, prefix="orch")
        if justif is not None and justif.filename:
            justif_path = _save_upload(justif, prefix="orch_justif")

        try:
            payload: Dict[str, Any] = await analyser_auto(main_path, justif_path, indice=hint)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[agent] erreur orchestrateur: {exc}", file=sys.stderr)
            raise HTTPException(status_code=500, detail=f"Echec orchestrateur: {exc}") from exc

        return JSONResponse(payload)
    finally:
        _cleanup(main_path, justif_path)


if __name__ == "__main__":
    port = int(os.environ.get("KYC_AGENT_PORT", "8500"))
    host = os.environ.get("KYC_AGENT_HOST", "0.0.0.0")
    uvicorn.run("api_server:app", host=host, port=port, reload=False)
