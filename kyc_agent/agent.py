"""LangGraph KYC agent — orchestrates MCP tools via Ollama LLM.

Exposé en HTTP par le Python Agent Server (``api_server.py``) qui est appelé
par Spring via AiOrchestratorService. L'agent se connecte au serveur FastMCP
de ``kyc_mcp_server/`` (SSE en prod, stdio en dev), invoque l'outil d'analyse
structurée, puis produit un rapport opérateur en français.
"""

import json
import os
import sys
from typing import Any, Dict

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent


SYSTEM_PROMPT = """Tu es un agent KYC d'une banque marocaine. Tu analyses des dossiers d'identité avec les outils fournis.

## Règle absolue
Tu DOIS appeler exactement une fois l'outil `analyser_dossier_kyc_complet` avec les deux chemins fournis par l'utilisateur. Tu n'analyses jamais les documents toi-même.

## Après l'appel à l'outil
L'outil retourne un JSON avec les clés : donnees_cin, donnees_justif, validation, validation_cin, validation_justif.
Tu produis ensuite UNIQUEMENT le rapport ci-dessous, en texte brut, sans markdown :

Décision finale : [APPROUVÉ / REJETÉ / À VÉRIFIER MANUELLEMENT]

Informations extraites :
  - Nom             : [valeur depuis donnees_cin.nom]
  - Prénom          : [valeur depuis donnees_cin.prenom]
  - N° CIN          : [valeur depuis donnees_cin.numero_cin]
  - Date naissance  : [valeur depuis donnees_cin.date_naissance]
  - Date expiration : [valeur depuis donnees_cin.date_expiration]
  - Adresse         : [valeur depuis donnees_justif.adresse]

Motif : [Phrase concise reprenant validation.message ou la liste validation.erreurs. "Aucun" si APPROUVÉ.]
Action requise : [AUCUNE si APPROUVÉ, sinon une instruction claire pour l'opérateur.]

Si l'outil renvoie une erreur, indique-le clairement et propose une vérification manuelle.
"""


def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _mcp_server_config() -> Dict[str, Dict[str, Any]]:
    """Two modes :
       * Default (stdio) : the agent spawns a fresh MCP server subprocess per run.
         Simple but reloads heavy models (YOLO/TrOCR/Qwen-VL) on every call.
       * SSE  (set KYC_MCP_URL or KYC_MCP_TRANSPORT=sse) : connect to a
         long-lived MCP server you started separately. Models stay in memory.
    """
    transport = os.environ.get("KYC_MCP_TRANSPORT", "").strip().lower()
    url = os.environ.get("KYC_MCP_URL", "").strip()

    if transport == "sse" or url:
        sse_url = url or f"http://127.0.0.1:{os.environ.get('KYC_MCP_PORT', '7800')}/sse"
        # CPU-bound VLM inference (Qwen-VL FP32) can take several minutes per
        # justificatif. Default SSE timeouts are too short — we set a generous
        # 15 min ceiling.
        timeout_seconds = float(os.environ.get("KYC_MCP_TIMEOUT_SECONDS", "900"))
        return {
            "kyc": {
                "transport": "sse",
                "url": sse_url,
                "timeout": timeout_seconds,
                "sse_read_timeout": timeout_seconds,
            }
        }

    root = _project_root()
    server_path = os.path.join(root, "kyc_mcp_server", "server.py")
    python_exe = os.environ.get("KYC_AGENT_PYTHON", sys.executable or "python")
    return {
        "kyc": {
            "command": python_exe,
            "args": [server_path],
            "transport": "stdio",
            "cwd": os.path.join(root, "kyc_mcp_server"),
        }
    }


def _candidate_strings(content) -> list:
    """langchain_mcp_adapters returns ToolMessage.content as a JSON string,
    or a list of content blocks ([{"type": "text", "text": "..."}, ...]) depending
    on versions. Normalise everything to a list of raw string candidates."""
    if content is None:
        return []
    if isinstance(content, str):
        return [content]
    if isinstance(content, dict):
        if "text" in content:
            return [content["text"]]
        return [json.dumps(content)]
    if isinstance(content, list):
        out = []
        for item in content:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                if item.get("type") == "text" and "text" in item:
                    out.append(item["text"])
                elif "text" in item:
                    out.append(item["text"])
                else:
                    out.append(json.dumps(item))
        return out
    return [str(content)]


def _extract_structured_payload(messages) -> Dict[str, Any]:
    """Find the ToolMessage emitted by analyser_dossier_kyc_complet and parse it."""
    last_error = None
    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        for raw in _candidate_strings(msg.content):
            try:
                parsed = json.loads(raw)
            except (TypeError, ValueError):
                continue
            if isinstance(parsed, dict) and "donnees_cin" in parsed and "validation" in parsed:
                return parsed
            if isinstance(parsed, dict) and "erreur" in parsed:
                last_error = parsed["erreur"]
    if last_error:
        return {"erreur": last_error}
    return {}


def _parse_tool_payload(tool_output: Any) -> Dict[str, Any]:
    """Parse the direct MCP tool output into the structured KYC payload."""
    for raw in _candidate_strings(tool_output):
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if isinstance(parsed, dict):
            return parsed
    if isinstance(tool_output, dict):
        return tool_output
    return {}


def _fallback_agent_report(payload: Dict[str, Any]) -> str:
    donnees_cin = payload.get("donnees_cin", {}) or {}
    donnees_justif = payload.get("donnees_justif", {}) or {}
    validation = payload.get("validation", {}) or {}
    statut = validation.get("statut", "A VERIFIER MANUELLEMENT")
    erreurs = validation.get("erreurs") or []
    message = validation.get("message") or ("; ".join(erreurs) if erreurs else "Aucun")
    action = "AUCUNE" if _strip_accents(statut) == "APPROUVE" else "Vérification manuelle par l'opérateur."

    return (
        f"Décision finale : {statut}\n\n"
        "Informations extraites :\n"
        f"  - Nom             : {donnees_cin.get('nom', 'N/A')}\n"
        f"  - Prénom          : {donnees_cin.get('prenom', 'N/A')}\n"
        f"  - N° CIN          : {donnees_cin.get('numero_cin', 'N/A')}\n"
        f"  - Date naissance  : {donnees_cin.get('date_naissance', 'N/A')}\n"
        f"  - Date expiration : {donnees_cin.get('date_expiration', 'N/A')}\n"
        f"  - Adresse         : {donnees_justif.get('adresse', 'N/A')}\n\n"
        f"Motif : {message}\n"
        f"Action requise : {action}"
    )


def _looks_like_unfilled_template(report: str) -> bool:
    lowered = (report or "").lower()
    required_sections = ("décision finale", "motif", "action requise")
    template_markers = (
        "[valeur",
        "depuis donnees_",
        "[approuvé / rejeté",
        "[phrase concise",
        "[aucune si",
    )
    return (
        not lowered.strip()
        or any(section not in lowered for section in required_sections)
        or any(marker in lowered for marker in template_markers)
    )


def _strip_accents(value: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFD", value or "")
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn").upper()


async def _run_structured_mcp_analysis(cin_path: str, justif_path: str) -> Dict[str, Any]:
    """Call the heavy MCP extraction/validation tool before starting Ollama.

    `langchain_mcp_adapters` opens a fresh MCP session for each direct tool
    call, so the heavy VLM server process exits before the LLM report step.
    This avoids keeping Qwen-VL and the Ollama model resident at the same time.
    """
    client = MultiServerMCPClient(_mcp_server_config())
    tools = await client.get_tools()
    tool = next((item for item in tools if item.name == "analyser_dossier_kyc_complet"), None)
    if tool is None:
        raise RuntimeError("Outil MCP introuvable: analyser_dossier_kyc_complet")

    tool_output = await tool.ainvoke({
        "chemin_image_cin": cin_path,
        "chemin_image_justif": justif_path,
    })
    payload = _parse_tool_payload(tool_output)
    if not payload:
        raise RuntimeError("L'outil MCP n'a renvoyé aucune sortie JSON exploitable")
    if "erreur" in payload:
        raise RuntimeError(f"Erreur outil MCP: {payload['erreur']}")
    return payload


async def _generate_agent_report(payload: Dict[str, Any], model_name: str) -> str:
    llm = ChatOllama(model=model_name, temperature=0.1)
    prompt = (
        "Voici la sortie JSON structurée de l'outil KYC. Rédige uniquement le "
        "rapport final demandé dans le prompt système, sans markdown.\n\n"
        + json.dumps(payload, ensure_ascii=False)
    )
    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])
    return getattr(response, "content", "") or ""


async def lancer_analyse_dossier_async(cin_path: str, justif_path: str) -> Dict[str, Any]:
    """Run the full agent workflow for a KYC dossier.

    Returns a dict ready to be serialized for the Spring backend, with the
    same shape produced by the legacy direct-import bridge plus an `agent_text`
    field carrying the agent's narrative report.
    """
    model_name = os.environ.get("KYC_AGENT_MODEL", "qwen2.5:3b")
    payload = await _run_structured_mcp_analysis(cin_path, justif_path)

    report_mode = os.environ.get("KYC_AGENT_REPORT_MODE", "llm").strip().lower()
    if report_mode in {"deterministic", "fast", "no-llm"}:
        final_text = _fallback_agent_report(payload)
    else:
        try:
            final_text = await _generate_agent_report(payload, model_name)
        except Exception as exc:
            print(f"[Agent] Rapport LLM indisponible, fallback déterministe: {exc}", file=sys.stderr)
            final_text = _fallback_agent_report(payload)
        if _looks_like_unfilled_template(final_text):
            print("[Agent] Rapport LLM inexploitable, fallback déterministe.", file=sys.stderr)
            final_text = _fallback_agent_report(payload)

    payload["agent_text"] = final_text
    payload["agent_model"] = model_name
    payload["agent_report_mode"] = report_mode
    return payload


# Backward-compatible single-document entrypoint kept for legacy callers.
async def lancer_analyse_async(chemin_image: str) -> dict:
    client = MultiServerMCPClient(_mcp_server_config())
    tools = await client.get_tools()
    llm = ChatOllama(model=os.environ.get("KYC_AGENT_MODEL", "qwen2.5:3b"), temperature=0.1)
    agent = create_react_agent(llm, tools, prompt=SystemMessage(content=SYSTEM_PROMPT))
    response = await agent.ainvoke({
        "messages": [HumanMessage(content=f"Veuillez analyser le document situé ici : {chemin_image}")]
    })
    return {"texte_ia": response["messages"][-1].content}
