from mcp.server.fastmcp import FastMCP
import json
import signal
import os
import sys
from tools.extractor import extract_document, extract_justificatif
from tools.validator import (
    validate_cin_dossier,
    validate_justificatif_domicile,
    validate_dossier_complet
)
from tools.reporter import generer_rapport

mcp = FastMCP("KYC_Banque_Server")


# ─────────────────────────────────────────
# TOOLS CIN
# ─────────────────────────────────────────

@mcp.tool()
def extraire_et_valider_cin(chemin_image: str) -> str:
    """Extract and validate a Moroccan CIN from an image path. Use this when the user provides a CIN image only."""
    try:
        donnees_brutes = extract_document(chemin_image)
        decision       = validate_cin_dossier(donnees_brutes)
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
        donnees = extract_justificatif(chemin_image)
        return json.dumps(donnees, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


@mcp.tool()
def valider_justificatif_domicile(donnees_justif: str) -> str:
    """Validate extracted proof-of-address data (JSON string from extraire_justificatif_domicile). Checks document age < 3 months and field completeness."""

    try:
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
    chemin_image_justif: str
) -> str:
    """Run the full KYC pipeline when the user provides both a CIN image and a proof-of-address image. Handles extraction, cross-validation and report generation."""
    try:
        # Extraction
        print("[Server] Extraction CIN...")
        donnees_cin = extract_document(chemin_image_cin)

        print("[Server] Extraction justificatif...")
        donnees_justif = extract_justificatif(chemin_image_justif)

        # Validation croisée
        print("[Server] Validation croisée...")
        decision = validate_dossier_complet(donnees_cin, donnees_justif)

        # Rapport
        generer_rapport(decision)

        return json.dumps(decision, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"erreur": str(e)}, ensure_ascii=False)


# ─────────────────────────────────────────
# SHUTDOWN + DÉMARRAGE
# ─────────────────────────────────────────

def shutdown_handler(sig, frame):
    print("🛑 Arrêt du serveur...")
    os._exit(0)

signal.signal(signal.SIGINT,  shutdown_handler)
signal.signal(signal.SIGTERM, shutdown_handler)

if __name__ == "__main__":
    print("🟢 Démarrage du Serveur FastMCP (KYC Agent)...", file=sys.stderr)
    mcp.run()