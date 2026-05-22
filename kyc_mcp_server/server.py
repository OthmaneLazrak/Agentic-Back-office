"""FastMCP server exposing KYC tools (extraction + validation).

Two transports:
  * stdio  (default) — spawned per request by the LangGraph agent. Cheap to start
                       but reloads heavy models (YOLO/TrOCR/Qwen-VL) on every call.
  * sse              — long-lived HTTP server. Models load once at boot and stay
                       in memory. Recommended for low-RAM machines.

Usage:
    python kyc_mcp_server/server.py                   # stdio
    python kyc_mcp_server/server.py --sse             # SSE on default port 7800
    python kyc_mcp_server/server.py --sse --port 9000

Environment:
    KYC_MCP_TRANSPORT=sse|stdio    overrides CLI flag
    KYC_MCP_PORT=7800              SSE port
    KYC_MCP_PREWARM=1              load models at boot with a dummy call
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
    from tools.extractor import extract_document, extract_justificatif
    from tools.validator import (
        validate_cin_dossier,
        validate_justificatif_domicile,
        validate_dossier_complet,
    )
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
    return FastMCP("KYC_Banque_Server", host="127.0.0.1", port=port)


# Mounted at module level so all tool decorators are registered before run().
# The port only matters for SSE; harmless for stdio.
_DEFAULT_PORT = int(os.environ.get("KYC_MCP_PORT", "7800"))
mcp = _build_mcp(_DEFAULT_PORT)


# ─────────────────────────────────────────
# TOOLS CIN
# ─────────────────────────────────────────

@mcp.tool()
def extraire_et_valider_cin(chemin_image: str) -> str:
    """Extract and validate a Moroccan CIN from an image path. Use this when the user provides a CIN image only."""
    try:
        with _stdout_to_stderr():
            donnees_brutes = extract_document(chemin_image)
            decision = validate_cin_dossier(donnees_brutes)
            generer_rapport(decision)
        return json.dumps(decision, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# TOOLS JUSTIFICATIF
# ─────────────────────────────────────────

@mcp.tool()
def extraire_justificatif_domicile(chemin_image: str) -> str:
    """Extract name, address and date from a proof-of-address image. Always follow up with valider_justificatif_domicile to validate the result."""
    try:
        with _stdout_to_stderr():
            donnees = extract_justificatif(chemin_image)
        return json.dumps(donnees, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


@mcp.tool()
def valider_justificatif_domicile(donnees_justif: str) -> str:
    """Validate extracted proof-of-address data (JSON string from extraire_justificatif_domicile). Checks document age < 3 months and field completeness."""
    try:
        with _stdout_to_stderr():
            donnees = json.loads(donnees_justif)
            decision = validate_justificatif_domicile(donnees)
        return json.dumps(decision, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# TOOL DOSSIER COMPLET (CIN + JUSTIFICATIF)
# ─────────────────────────────────────────

@mcp.tool()
def valider_dossier_complet_kyc(
    chemin_image_cin: str,
    chemin_image_justif: str,
) -> str:
    """Run the full KYC pipeline when the user provides both a CIN image and a proof-of-address image. Handles extraction, cross-validation and report generation."""
    try:
        with _stdout_to_stderr():
            print("[Server] Extraction CIN...", file=sys.stderr)
            donnees_cin = extract_document(chemin_image_cin)

            print("[Server] Extraction justificatif...", file=sys.stderr)
            donnees_justif = extract_justificatif(chemin_image_justif)

            print("[Server] Validation croisée...", file=sys.stderr)
            decision = validate_dossier_complet(donnees_cin, donnees_justif)

            generer_rapport(decision)

        return json.dumps(decision, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# TOOL DOSSIER COMPLET — version structurée pour orchestration
# ─────────────────────────────────────────

@mcp.tool()
def analyser_dossier_kyc_complet(
    chemin_image_cin: str,
    chemin_image_justif: str,
) -> str:
    """Analyse a full KYC dossier (CIN + proof of address) and return ALL structured data:
    extracted CIN fields, extracted address proof fields, cross-validation result,
    CIN-only validation, address-only validation. Returns a JSON object with keys:
    donnees_cin, donnees_justif, validation, validation_cin, validation_justif.
    Use this tool when both file paths are provided."""
    try:
        with _stdout_to_stderr():
            print("[Server] [Complet] Extraction CIN...", file=sys.stderr)
            donnees_cin = extract_document(chemin_image_cin)

            print("[Server] [Complet] Extraction justificatif...", file=sys.stderr)
            donnees_justif = extract_justificatif(chemin_image_justif)

            print("[Server] [Complet] Validations...", file=sys.stderr)
            validation = validate_dossier_complet(donnees_cin, donnees_justif)
            validation_cin = validate_cin_dossier(donnees_cin)
            validation_justif = validate_justificatif_domicile(donnees_justif)

        return json.dumps({
            "donnees_cin": donnees_cin,
            "donnees_justif": donnees_justif,
            "validation": validation,
            "validation_cin": validation_cin,
            "validation_justif": validation_justif,
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# Pre-warm: load heavy models at boot so the first call is fast and there is
# no concurrent loading from multiple requests.
# ─────────────────────────────────────────

def _prewarm_models() -> None:
    print("[Server] Pré-chargement des modèles (warm start)...", file=sys.stderr)
    with _stdout_to_stderr():
        # Import the internal loaders directly — the public extract_* functions
        # do an os.path.exists() guard that returns BEFORE any model is loaded.
        from tools.extractor import (
            _charger_modeles_cin,
            _charger_modele_justif_qwen,
        )
        try:
            print("[Server] Chargement YOLO + TrOCR...", file=sys.stderr)
            _charger_modeles_cin()
        except Exception as exc:
            print(f"[Server] Échec chargement CIN : {exc}", file=sys.stderr)
        try:
            print("[Server] Chargement Qwen-VL + LoRA...", file=sys.stderr)
            _charger_modele_justif_qwen()
        except Exception as exc:
            print(f"[Server] Échec chargement justificatif : {exc}", file=sys.stderr)
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
    parser = argparse.ArgumentParser(description="KYC FastMCP server")
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

    transport_env = os.environ.get("KYC_MCP_TRANSPORT", "").strip().lower()
    use_sse = args.sse or transport_env == "sse"

    # Recreate the FastMCP instance if the requested port differs from the
    # one we used at module load. Tool decorators stay attached because they
    # reference `mcp`; in practice the port only matters for SSE so the rare
    # rebuild path is acceptable.
    if use_sse and args.port != _DEFAULT_PORT:
        # Keep the existing instance, but FastMCP doesn't expose a setter for
        # host/port post-init. We rebuild and re-register tools.
        print(
            f"[Server] Note: pour changer le port, utilise KYC_MCP_PORT={args.port} "
            "au lancement (variable d'environnement).",
            file=sys.stderr,
        )

    if use_sse and (args.prewarm or os.environ.get("KYC_MCP_PREWARM") == "1"):
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
