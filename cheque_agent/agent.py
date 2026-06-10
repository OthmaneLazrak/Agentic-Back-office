"""LangGraph CHÈQUE agent — orchestrates MCP tools via Ollama LLM.

Calqué sur l'agent KYC : se connecte au serveur FastMCP de ``cheque_mcp_server/``
(SSE en prod, stdio en dev), invoque l'outil d'analyse structurée
``analyser_cheque_complet``, puis produit un rapport opérateur en français.
"""

import json
import os
import sys
from typing import Any, Dict

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent


SYSTEM_PROMPT = """Tu es un agent d'analyse de chèques d'une banque marocaine. Tu analyses des chèques avec les outils fournis.

## Règle absolue
Tu DOIS appeler exactement une fois l'outil `analyser_cheque_complet` avec le chemin fourni par l'utilisateur. Tu n'analyses jamais le chèque toi-même.

## Après l'appel à l'outil
L'outil retourne un JSON avec les clés : donnees_manuscrit, donnees_zones, validation.
Tu produis ensuite UNIQUEMENT le rapport ci-dessous, en texte brut, sans markdown :

Décision finale : [VALIDE / REJETÉ / À VÉRIFIER MANUELLEMENT]

Informations extraites :
  - Montant (chiffres) : [valeur depuis donnees_manuscrit.montant_chiffre]
  - Montant (lettres)  : [valeur depuis donnees_manuscrit.montant_lettre]
  - Bénéficiaire       : [valeur depuis donnees_manuscrit.beneficiaire]
  - N° de compte       : [détecté: oui/non depuis donnees_zones.num_compte.crop]
  - Signature          : [présente/absente depuis donnees_zones.signature.present]
  - Bande CMC7         : [détectée: oui/non depuis donnees_zones.cmc7.crop]

Motif : [Phrase concise reprenant validation.message ou la liste validation.erreurs. "Aucun" si VALIDE.]
Action requise : [AUCUNE si VALIDE, sinon une instruction claire pour l'opérateur.]

Si l'outil renvoie une erreur, indique-le clairement et propose une vérification manuelle.
"""


def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _mcp_server_config() -> Dict[str, Dict[str, Any]]:
    """stdio (dev, défaut) ou sse (prod, modèles résidents)."""
    transport = os.environ.get("CHEQUE_MCP_TRANSPORT", "").strip().lower()
    url = os.environ.get("CHEQUE_MCP_URL", "").strip()

    if transport == "sse" or url:
        sse_url = url or f"http://127.0.0.1:{os.environ.get('CHEQUE_MCP_PORT', '7810')}/sse"
        timeout_seconds = float(os.environ.get("CHEQUE_MCP_TIMEOUT_SECONDS", "900"))
        return {
            "cheque": {
                "transport": "sse",
                "url": sse_url,
                "timeout": timeout_seconds,
                "sse_read_timeout": timeout_seconds,
            }
        }

    root = _project_root()
    server_path = os.path.join(root, "cheque_mcp_server", "server.py")
    python_exe = os.environ.get("CHEQUE_AGENT_PYTHON", sys.executable or "python")
    return {
        "cheque": {
            "command": python_exe,
            "args": [server_path],
            "transport": "stdio",
            "cwd": os.path.join(root, "cheque_mcp_server"),
        }
    }


def _candidate_strings(content) -> list:
    if content is None:
        return []
    if isinstance(content, str):
        return [content]
    if isinstance(content, dict):
        return [content["text"]] if "text" in content else [json.dumps(content)]
    if isinstance(content, list):
        out = []
        for item in content:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                out.append(item.get("text", json.dumps(item)))
        return out
    return [str(content)]


def _parse_tool_payload(tool_output: Any) -> Dict[str, Any]:
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


def _strip_accents(value: str) -> str:
    import unicodedata
    normalized = unicodedata.normalize("NFD", value or "")
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn").upper()


def _fallback_agent_report(payload: Dict[str, Any]) -> str:
    man = payload.get("donnees_manuscrit", {}) or {}
    zones = payload.get("donnees_zones", {}) or {}
    val = payload.get("validation", {}) or {}
    statut = val.get("statut", "A VERIFIER MANUELLEMENT")
    erreurs = val.get("erreurs") or []
    message = val.get("message") or ("; ".join(erreurs) if erreurs else "Aucun")
    action = "AUCUNE" if _strip_accents(statut) == "VALIDE" else "Vérification manuelle par l'opérateur."

    def oui(d, k="crop"):
        return "oui" if (d or {}).get(k) else "non"

    sig = zones.get("signature", {}) or {}
    return (
        f"Décision finale : {statut}\n\n"
        "Informations extraites :\n"
        f"  - Montant (chiffres) : {man.get('montant_chiffre', 'N/A')}\n"
        f"  - Montant (lettres)  : {man.get('montant_lettre', 'N/A')}\n"
        f"  - Bénéficiaire       : {man.get('beneficiaire', 'N/A')}\n"
        f"  - N° de compte       : détecté: {oui(zones.get('num_compte'))}\n"
        f"  - Signature          : {'présente' if sig.get('present') else 'absente'}\n"
        f"  - Bande CMC7         : détectée: {oui(zones.get('cmc7'))}\n\n"
        f"Motif : {message}\n"
        f"Action requise : {action}"
    )


def _looks_like_unfilled_template(report: str) -> bool:
    lowered = (report or "").lower()
    required = ("décision finale", "motif", "action requise")
    markers = ("[valeur", "depuis donnees_", "[valide /", "[phrase concise", "[aucune si")
    return (not lowered.strip()
            or any(s not in lowered for s in required)
            or any(m in lowered for m in markers))


async def _run_structured_mcp_analysis(image_path: str) -> Dict[str, Any]:
    client = MultiServerMCPClient(_mcp_server_config())
    tools = await client.get_tools()
    tool = next((t for t in tools if t.name == "analyser_cheque_complet"), None)
    if tool is None:
        raise RuntimeError("Outil MCP introuvable: analyser_cheque_complet")
    tool_output = await tool.ainvoke({"chemin_image": image_path})
    payload = _parse_tool_payload(tool_output)
    if not payload:
        raise RuntimeError("L'outil MCP n'a renvoyé aucune sortie JSON exploitable")
    if "erreur" in payload:
        raise RuntimeError(f"Erreur outil MCP: {payload['erreur']}")
    return payload


async def _generate_agent_report(payload: Dict[str, Any], model_name: str) -> str:
    llm = ChatOllama(model=model_name, temperature=0.1)
    prompt = (
        "Voici la sortie JSON structurée de l'outil chèque. Rédige uniquement le "
        "rapport final demandé dans le prompt système, sans markdown.\n\n"
        + json.dumps(payload, ensure_ascii=False)
    )
    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])
    return getattr(response, "content", "") or ""


async def lancer_analyse_cheque_async(image_path: str) -> Dict[str, Any]:
    """Workflow complet pour un chèque. Renvoie le payload + agent_text."""
    model_name = os.environ.get("CHEQUE_AGENT_MODEL", "qwen2.5:3b")
    payload = await _run_structured_mcp_analysis(image_path)

    report_mode = os.environ.get("CHEQUE_AGENT_REPORT_MODE", "llm").strip().lower()
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


# Entrée mono-document via agent réactif (équivalent legacy KYC).
async def lancer_analyse_async(chemin_image: str) -> dict:
    client = MultiServerMCPClient(_mcp_server_config())
    tools = await client.get_tools()
    llm = ChatOllama(model=os.environ.get("CHEQUE_AGENT_MODEL", "qwen2.5:3b"), temperature=0.1)
    agent = create_react_agent(llm, tools, prompt=SystemMessage(content=SYSTEM_PROMPT))
    response = await agent.ainvoke({
        "messages": [HumanMessage(content=f"Veuillez analyser le chèque situé ici : {chemin_image}")]
    })
    return {"texte_ia": response["messages"][-1].content}
