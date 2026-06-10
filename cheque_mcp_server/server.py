"""FastMCP server exposing CHÈQUE tools (extraction + validation).

Calqué sur ``kyc_mcp_server/server.py``. Deux transports :
  * stdio  (default) — spawned per request by the LangGraph agent. Cheap to start
                       but reloads heavy models (YOLO/TrOCR/Qwen-VL) on every call.
  * sse              — long-lived HTTP server. Models load once at boot and stay
                       in memory. Recommended for low-RAM machines.

Usage:
    python cheque_mcp_server/server.py                   # stdio
    python cheque_mcp_server/server.py --sse             # SSE on default port 7810
    python cheque_mcp_server/server.py --sse --port 9000

Environment:
    CHEQUE_MCP_TRANSPORT=sse|stdio    overrides CLI flag
    CHEQUE_MCP_PORT=7810              SSE port
    CHEQUE_MCP_PREWARM=1              load models at boot with a dummy call
                                      (only effective with --sse)
"""

import argparse
import contextlib
import json
import os
import signal
import sys

# Allow running this file from any working directory: `from tools.X import ...`
# is relative to this script's directory, not the caller's cwd.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# FastMCP communicates over stdio with JSON-RPC frames on stdout. Any stray
# print() from imported tool modules (model loading, debug traces) would corrupt
# the protocol. We swap stdout for stderr DURING the imports below, then restore
# it for FastMCP to use cleanly.
_real_stdout = sys.stdout
sys.stdout = sys.stderr
try:
    from mcp.server.fastmcp import FastMCP
    from tools.extractor import extract_manuscrit, extract_zones
    from tools.validator import validate_cheque
    from tools.reporter import generer_rapport
finally:
    sys.stdout = _real_stdout


@contextlib.contextmanager
def _stdout_to_stderr():
    """Tool code prints to stdout (model loading, debug). Inside MCP that
    corrupts JSON-RPC frames. We force tool prints to stderr."""
    with contextlib.redirect_stdout(sys.stderr):
        yield


def _build_mcp(port: int) -> "FastMCP":
    return FastMCP("Cheque_Banque_Server", host="127.0.0.1", port=port)


# Mounted at module level so all tool decorators are registered before run().
# The port only matters for SSE; harmless for stdio.
_DEFAULT_PORT = int(os.environ.get("CHEQUE_MCP_PORT", "7810"))
mcp = _build_mcp(_DEFAULT_PORT)


# ─────────────────────────────────────────
# TOOLS GRANULAIRES
# ─────────────────────────────────────────

@mcp.tool()
def extraire_manuscrit_cheque(chemin_image: str) -> str:
    """Read the handwritten amounts (figures + words) and beneficiary from a cheque image. Returns a JSON object: montant_chiffre, montant_lettre, beneficiaire."""
    try:
        with _stdout_to_stderr():
            donnees = extract_manuscrit(chemin_image)
        return json.dumps(donnees, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


@mcp.tool()
def extraire_zones_cheque(chemin_image: str) -> str:
    """Detect the account number, signature and CMC7 band on a cheque image (YOLO) and OCR the printed zones (TrOCR). Returns a JSON object: num_compte, signature, cmc7."""
    try:
        with _stdout_to_stderr():
            donnees = extract_zones(chemin_image)
        return json.dumps(donnees, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# TOOL CHÈQUE COMPLET — version structurée pour orchestration
# ─────────────────────────────────────────

@mcp.tool()
def analyser_cheque_complet(chemin_image: str) -> str:
    """Analyse a full cheque and return ALL structured data:
    handwritten fields (amounts + beneficiary), detected zones (account number,
    signature, CMC7 band) and the validation result. Returns a JSON object with
    keys: donnees_manuscrit, donnees_zones, validation.
    Use this tool when a cheque image path is provided."""
    try:
        if not os.path.isfile(chemin_image):
            return json.dumps({"erreur": f"Image introuvable: {chemin_image}"}, ensure_ascii=False)

        with _stdout_to_stderr():
            print("[Server] [Complet] Lecture du manuscrit (VLM)...", file=sys.stderr)
            donnees_manuscrit = extract_manuscrit(chemin_image)

            print("[Server] [Complet] Détection des zones (YOLO + TrOCR)...", file=sys.stderr)
            donnees_zones = extract_zones(chemin_image)

            print("[Server] [Complet] Validation...", file=sys.stderr)
            validation = validate_cheque(donnees_manuscrit, donnees_zones)

            generer_rapport({
                "image": os.path.basename(chemin_image),
                "donnees_manuscrit": donnees_manuscrit,
                "donnees_zones": donnees_zones,
                "validation": validation,
            })

        return json.dumps({
            "image": os.path.basename(chemin_image),
            "donnees_manuscrit": donnees_manuscrit,
            "donnees_zones": donnees_zones,
            "validation": validation,
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# TOOL DE LIBÉRATION MÉMOIRE (orchestration multi-agents)
# ─────────────────────────────────────────

@mcp.tool()
def liberer_modeles_cheque() -> str:
    """Free the cheque heavy models (Qwen-VL/YOLO/TrOCR) from GPU/RAM so another agent
    can use the VRAM. Called by the orchestrator before switching to another domain."""
    try:
        with _stdout_to_stderr():
            from tools.extractor import liberer_modeles
            liberer_modeles()
        return json.dumps({"status": "ok", "message": "Modèles chèque libérés"}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# Pre-warm: load heavy models at boot so the first call is fast and there is
# no concurrent loading from multiple requests.
# ─────────────────────────────────────────

def _prewarm_models() -> None:
    print("[Server] Pré-chargement des modèles (warm start)...", file=sys.stderr)
    with _stdout_to_stderr():
        from tools.extractor import (
            _charger_modele_vlm,
            _charger_modele_yolo,
            _charger_modele_trocr,
        )
        try:
            print("[Server] Chargement Qwen-VL + LoRA...", file=sys.stderr)
            _charger_modele_vlm()
        except Exception as exc:
            print(f"[Server] Échec chargement VLM : {exc}", file=sys.stderr)
        try:
            print("[Server] Chargement YOLO...", file=sys.stderr)
            _charger_modele_yolo()
        except Exception as exc:
            print(f"[Server] Échec chargement YOLO : {exc}", file=sys.stderr)
        try:
            print("[Server] Chargement TrOCR...", file=sys.stderr)
            _charger_modele_trocr()
        except Exception as exc:
            print(f"[Server] Échec chargement TrOCR : {exc}", file=sys.stderr)
    print("[Server] Modèles prêts.", file=sys.stderr)


# ─────────────────────────────────────────
# SHUTDOWN + DÉMARRAGE
# ─────────────────────────────────────────

def shutdown_handler(sig, frame):
    print("🛑 Arrêt du serveur...", file=sys.stderr)
    os._exit(0)


signal.signal(signal.SIGINT, shutdown_handler)
signal.signal(signal.SIGTERM, shutdown_handler)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cheque FastMCP server")
    parser.add_argument(
        "--sse",
        action="store_true",
        help="Run as long-lived HTTP/SSE server instead of stdio.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=_DEFAULT_PORT,
        help=f"SSE port (default {_DEFAULT_PORT}).",
    )
    parser.add_argument(
        "--prewarm",
        action="store_true",
        help="Load heavy models at boot (SSE mode only).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    transport_env = os.environ.get("CHEQUE_MCP_TRANSPORT", "").strip().lower()
    use_sse = args.sse or transport_env == "sse"

    # The port only matters for SSE; to change it, prefer CHEQUE_MCP_PORT at launch.
    if use_sse and args.port != _DEFAULT_PORT:
        print(
            f"[Server] Note: pour changer le port, utilise CHEQUE_MCP_PORT={args.port} "
            "au lancement (variable d'environnement).",
            file=sys.stderr,
        )

    if use_sse and (args.prewarm or os.environ.get("CHEQUE_MCP_PREWARM") == "1"):
        _prewarm_models()

    if use_sse:
        print(
            f"🟢 Démarrage FastMCP en mode SSE sur http://127.0.0.1:{_DEFAULT_PORT}/sse",
            file=sys.stderr,
        )
        mcp.run(transport="sse")
    else:
        print("🟢 Démarrage FastMCP en mode stdio...", file=sys.stderr)
        mcp.run()
