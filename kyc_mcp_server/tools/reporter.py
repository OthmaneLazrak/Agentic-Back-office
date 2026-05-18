import json
import os
from datetime import datetime


def generer_rapport(decision_data: dict, output_dir: str = "rapports") -> str:
    """Génère un fichier de rapport d'audit au format JSON."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nom_fichier = f"rapport_kyc_{timestamp}.json"
    chemin_complet = os.path.join(output_dir, nom_fichier)

    decision_data["date_analyse"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(chemin_complet, 'w', encoding='utf-8') as f:
        json.dump(decision_data, f, indent=4, ensure_ascii=False)

    print(f"[Reporter] Rapport sauvegardé sous : {chemin_complet}")
    return chemin_complet