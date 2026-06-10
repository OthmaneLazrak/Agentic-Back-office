"""Agent ORCHESTRATEUR — décide quel agent spécialisé traite la demande.

Principe respecté : « 1 agent = 1 MCP server ». L'orchestrateur ne fait PAS
l'extraction lui-même ; il :

  1. décide la route (kyc | cheque) — classification LLM (Ollama) avec repli
     déterministe sur le nombre de documents ;
  2. gère la VRAM : avant de lancer un domaine, il libère les modèles de
     l'AUTRE domaine via le tool MCP ``liberer_modeles_*`` (un seul VLM
     résident à la fois — indispensable sur GPU 6 Go) ;
  3. délègue à l'agent spécialisé (``kyc_agent`` ou ``cheque_agent``), qui
     parle à son propre serveur MCP.

        api_server ──► orchestrator_agent ──► kyc_agent     ──► kyc_mcp_server
                                          └─► cheque_agent  ──► cheque_mcp_server

L'éviction n'a lieu qu'au CHANGEMENT de domaine (mémorisé en process), donc
deux analyses consécutives du même type ne rechargent rien.
"""

import os
import sys
from typing import Any, Dict, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_ollama import ChatOllama

from kyc_agent.agent import lancer_analyse_dossier_async
from cheque_agent.agent import lancer_analyse_cheque_async


ROUTER_SYSTEM_PROMPT = """Tu es un routeur d'une banque marocaine. Tu choisis quel agent doit traiter une demande.

Deux agents existent :
- "kyc"    : analyse un dossier d'identité (Carte Nationale d'Identité + justificatif de domicile). Typiquement 2 documents.
- "cheque" : analyse un chèque bancaire (montants, bénéficiaire, signature, CMC7). Typiquement 1 document.

Réponds STRICTEMENT par un seul mot, sans ponctuation : kyc OU cheque.
"""


# ─────────────────────────────────────────
# Configuration MCP des domaines (pour la libération mémoire)
# ─────────────────────────────────────────

def _kyc_sse_url() -> str:
    return os.environ.get("KYC_MCP_URL", "").strip() or \
        f"http://127.0.0.1:{os.environ.get('KYC_MCP_PORT', '7800')}/sse"


def _cheque_sse_url() -> str:
    return os.environ.get("CHEQUE_MCP_URL", "").strip() or \
        f"http://127.0.0.1:{os.environ.get('CHEQUE_MCP_PORT', '7810')}/sse"


_DOMAINES = {
    "kyc": {"url": _kyc_sse_url, "unload_tool": "liberer_modeles_kyc"},
    "cheque": {"url": _cheque_sse_url, "unload_tool": "liberer_modeles_cheque"},
}

# Domaine actuellement « chaud » (modèles en VRAM). Persiste dans le process
# api_server, donc on n'évince l'autre domaine qu'au changement.
_domaine_courant: Optional[str] = None


async def _liberer_domaine(domaine: str) -> None:
    """Appelle le tool de libération mémoire du MCP ``domaine`` (best-effort).

    Si le serveur MCP est injoignable ou que les modèles ne sont pas chargés,
    on ignore l'erreur : l'objectif est seulement de libérer la VRAM.
    """
    cfg_dom = _DOMAINES.get(domaine)
    if not cfg_dom:
        return
    timeout = float(os.environ.get("ORCHESTRATOR_UNLOAD_TIMEOUT", "120"))
    cfg = {
        domaine: {
            "transport": "sse",
            "url": cfg_dom["url"](),
            "timeout": timeout,
            "sse_read_timeout": timeout,
        }
    }
    try:
        client = MultiServerMCPClient(cfg)
        tools = await client.get_tools()
        tool = next((t for t in tools if t.name == cfg_dom["unload_tool"]), None)
        if tool is not None:
            await tool.ainvoke({})
            print(f"[Orchestrateur] VRAM du domaine '{domaine}' libérée.", file=sys.stderr)
    except Exception as exc:
        print(f"[Orchestrateur] Libération '{domaine}' ignorée: {exc}", file=sys.stderr)


async def _basculer_vers(domaine: str) -> None:
    """Garantit qu'un seul domaine est chaud : évince l'autre si on change."""
    global _domaine_courant
    if _domaine_courant == domaine:
        return
    autre = "cheque" if domaine == "kyc" else "kyc"
    await _liberer_domaine(autre)
    _domaine_courant = domaine


# ─────────────────────────────────────────
# Décision de route (classification LLM + repli déterministe)
# ─────────────────────────────────────────

async def decider_route(indice: str = "", nb_documents: int = 0) -> str:
    """Choisit 'kyc' ou 'cheque'. LLM Ollama, repli déterministe sur le nb de docs."""
    fallback = "kyc" if nb_documents >= 2 else "cheque"

    mode = os.environ.get("ORCHESTRATOR_ROUTER", "llm").strip().lower()
    if mode in {"deterministic", "fast", "no-llm"}:
        return fallback

    model_name = os.environ.get(
        "ORCHESTRATOR_MODEL",
        os.environ.get("KYC_AGENT_MODEL", "qwen2.5:3b"),
    )
    try:
        llm = ChatOllama(model=model_name, temperature=0)
        user = (
            f"Indice fourni : '{indice or 'aucun'}'. "
            f"Nombre de documents reçus : {nb_documents}. "
            "Quel agent doit traiter cette demande ?"
        )
        response = await llm.ainvoke([
            SystemMessage(content=ROUTER_SYSTEM_PROMPT),
            HumanMessage(content=user),
        ])
        txt = (getattr(response, "content", "") or "").strip().lower()
        if "cheque" in txt or "chèque" in txt:
            return "cheque"
        if "kyc" in txt:
            return "kyc"
        return fallback
    except Exception as exc:
        print(f"[Orchestrateur] Routage LLM indisponible, repli '{fallback}': {exc}", file=sys.stderr)
        return fallback


# ─────────────────────────────────────────
# Points d'entrée orchestrés
# ─────────────────────────────────────────

async def analyser_kyc(cin_path: str, justif_path: str) -> Dict[str, Any]:
    """Libère la VRAM du chèque puis délègue au pipeline KYC."""
    await _basculer_vers("kyc")
    payload = await lancer_analyse_dossier_async(cin_path, justif_path)
    payload["route"] = "kyc"
    return payload


async def analyser_cheque(image_path: str) -> Dict[str, Any]:
    """Libère la VRAM du KYC puis délègue au pipeline chèque."""
    await _basculer_vers("cheque")
    payload = await lancer_analyse_cheque_async(image_path)
    payload["route"] = "cheque"
    return payload


async def analyser_auto(
    file_path: str,
    justif_path: Optional[str] = None,
    indice: str = "",
) -> Dict[str, Any]:
    """Point d'entrée 'l'orchestrateur décide' : classe la demande via LLM puis dispatche.

    - 2 documents (file + justif) -> contexte fortement KYC.
    - 1 document               -> contexte fortement chèque.
    Le LLM tranche en s'appuyant sur l'indice + le nombre de documents.
    """
    nb = 2 if justif_path else 1
    route = await decider_route(indice=indice, nb_documents=nb)

    if route == "kyc":
        if not justif_path:
            # KYC exige 2 documents : sans justificatif, on retombe sur le chèque.
            print("[Orchestrateur] Route KYC mais justificatif absent -> bascule chèque.", file=sys.stderr)
            return await analyser_cheque(file_path)
        return await analyser_kyc(file_path, justif_path)

    return await analyser_cheque(file_path)
