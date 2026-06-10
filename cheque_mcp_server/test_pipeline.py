# -*- coding: utf-8 -*-
"""Test rapide du pipeline chèque (extraction + validation), hors MCP.

Reproduit la logique de ``analyser_cheque_complet`` du serveur en assemblant
directement les tools extractor + validator.

    python cheque_mcp_server/test_pipeline.py [chemin_image]
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.extractor import extract_manuscrit, extract_zones
from tools.validator import validate_cheque


def analyser_cheque(chemin_image: str) -> dict:
    if not os.path.isfile(chemin_image):
        return {"erreur": f"Image introuvable: {chemin_image}"}
    manuscrit = extract_manuscrit(chemin_image)
    zones = extract_zones(chemin_image)
    validation = validate_cheque(manuscrit, zones)
    return {
        "image": os.path.basename(chemin_image),
        "donnees_manuscrit": manuscrit,
        "donnees_zones": zones,
        "validation": validation,
    }


if __name__ == "__main__":
    image = sys.argv[1] if len(sys.argv) > 1 else "test/atw2.jpg"
    res = analyser_cheque(image)
    print(json.dumps(res, indent=2, ensure_ascii=False))
