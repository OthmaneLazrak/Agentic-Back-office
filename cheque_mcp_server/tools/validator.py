# -*- coding: utf-8 -*-
"""Validation métier d'un chèque.

Calqué sur ``kyc_mcp_server/tools/validator.py`` : prend les données extraites
(manuscrit + zones) et produit une décision structurée {statut, message, erreurs}.

Statuts possibles :
  * VALIDE                    — tous les champs présents et lisibles
  * A VERIFIER MANUELLEMENT   — 1 ou 2 anomalies (contrôle opérateur)
  * REJETE                    — 3 anomalies ou plus
"""


def validate_cheque(manuscrit: dict, zones: dict) -> dict:
    """Validation d'un chèque à partir des données extraites.

    Vérifie : montants (chiffres + lettres), bénéficiaire, numéro de compte,
    signature et bande CMC7.
    """
    print("\n[Validator] Validation chèque...")

    manuscrit = manuscrit or {}
    zones = zones or {}

    # Échec d'extraction en amont -> rejet direct (même logique que le KYC).
    if manuscrit.get("extraction_status") == "FAILED":
        return {
            "statut": "REJETE",
            "message": manuscrit.get("erreur", "Échec de lecture du manuscrit."),
            "erreurs": [manuscrit.get("erreur", "Échec de lecture du manuscrit.")],
        }
    if zones.get("extraction_status") == "FAILED":
        return {
            "statut": "REJETE",
            "message": zones.get("erreur", "Échec de détection des zones."),
            "erreurs": [zones.get("erreur", "Échec de détection des zones.")],
        }

    num_compte = zones.get("num_compte", {}) or {}
    cmc7 = zones.get("cmc7", {}) or {}
    signature = zones.get("signature", {}) or {}

    erreurs = []

    # ── Manuscrit ──────────────────────────
    if not manuscrit.get("montant_chiffre"):
        erreurs.append("Montant en chiffres illisible")
    if not manuscrit.get("montant_lettre"):
        erreurs.append("Montant en lettres illisible")
    if not manuscrit.get("beneficiaire"):
        erreurs.append("Bénéficiaire absent")

    # ── Numéro de compte ───────────────────
    if not num_compte.get("crop"):
        erreurs.append("Numéro de compte non détecté")
    elif not num_compte.get("text"):
        erreurs.append("Numéro de compte détecté mais illisible")

    # ── Signature ──────────────────────────
    if not signature.get("present"):
        erreurs.append("Signature non détectée")

    # ── Bande CMC7 ─────────────────────────
    if not cmc7.get("crop"):
        erreurs.append("Bande CMC7 non détectée")
    elif not cmc7.get("text"):
        erreurs.append("Bande CMC7 détectée mais illisible")

    # ── Décision finale ────────────────────
    if not erreurs:
        return {
            "statut": "VALIDE",
            "message": "Tous les champs sont présents et lisibles.",
            "erreurs": [],
        }
    elif len(erreurs) <= 2:
        return {
            "statut": "A VERIFIER MANUELLEMENT",
            "message": "; ".join(erreurs),
            "erreurs": erreurs,
        }
    else:
        return {
            "statut": "REJETE",
            "message": "; ".join(erreurs),
            "erreurs": erreurs,
        }
