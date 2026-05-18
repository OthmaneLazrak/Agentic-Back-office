import re
from datetime import datetime
from rapidfuzz import fuzz


def validate_cin_dossier(donnees_extraites: dict) -> dict:
    """
    Validation KYC CIN uniquement.
    Vérifie complétude, majorité, format date.
    """
    print("\n[Validator] Validation CIN...")

    if donnees_extraites.get("extraction_status") == "FAILED":
        return {
            "statut": "REJETÉ",
            "erreurs": [donnees_extraites.get("erreur", "Échec de lecture visuelle.")]
        }

    erreurs        = []
    donnees_propres = {}

    # 1. Complétude
    champs_requis = ["nom", "prenom", "date_naissance", "numero_cin", "date_expiration"]
    for champ in champs_requis:
        valeur = donnees_extraites.get(champ)
        if not valeur or valeur.strip() == "":
            erreurs.append(f"Champ obligatoire manquant : '{champ.upper()}'")
        else:
            donnees_propres[champ] = valeur.strip().upper()

    # 2. Majorité
    date_texte = donnees_extraites.get("date_naissance")
    if date_texte:
        date_propre = re.sub(r'[\s.\-\\,]+', '/', date_texte.strip())
        try:
            date_obj = datetime.strptime(date_propre, "%d/%m/%Y")
            age      = (datetime.now() - date_obj).days // 365
            donnees_propres["age_calcule"] = age
            if age < 18:
                erreurs.append(
                    f"Client mineur ({age} ans). Minimum requis : 18 ans."
                )
        except ValueError:
            erreurs.append(
                f"Format date de naissance invalide : '{date_texte}'"
            )

    if not erreurs:
        return {
            "statut":          "APPROUVÉ",
            "message":         "Dossier CIN conforme.",
            "donnees_propres": donnees_propres
        }
    else:
        return {
            "statut":         "REJETÉ",
            "erreurs":        erreurs,
            "donnees_brutes": donnees_extraites
        }


def validate_justificatif_domicile(donnees_justif: dict) -> dict:
    """
    Validation KYC Justificatif de domicile.
    Vérifie : Complétude (Nom, Adresse). La date est ignorée pour la V1 du modèle VLM.
    """
    print("\n[Validator] Validation Justificatif domicile...")

    if donnees_justif.get("extraction_status") == "FAILED":
        return {
            "statut": "REJETÉ",
            "erreurs": [donnees_justif.get("erreur", "Échec extraction justificatif.")]
        }

    erreurs         = []
    donnees_propres = {}

    # 1. Complétude (On a retiré "date" des champs obligatoires)
    for champ in ["nom", "adresse"]:
        valeur = donnees_justif.get(champ)
        if not valeur or str(valeur).strip() == "":
            erreurs.append(f"Champ manquant dans le justificatif : '{champ.upper()}'")
        else:
            donnees_propres[champ] = str(valeur).strip()

    # 2. Gestion de la Date (Ignorée car le VLM ne l'extrait pas)
    date_texte = donnees_justif.get("date")
    if date_texte and str(date_texte).strip():
        # Si un jour le modèle V2 extrait la date, ce code fonctionnera
        date_propre = re.sub(r'[\s.\-\\,]+', '/', str(date_texte).strip())
        date_obj    = None

        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"]:
            try:
                date_obj = datetime.strptime(date_propre, fmt)
                break
            except ValueError:
                continue

        if date_obj is None:
            erreurs.append(f"Format de date invalide : '{date_texte}'")
        else:
            age_jours = (datetime.now() - date_obj).days
            donnees_propres["age_document_jours"] = age_jours

            if date_obj > datetime.now():
                erreurs.append("Date du document dans le futur.")
            elif age_jours > 90:
                erreurs.append(f"Document trop ancien ({age_jours} jours). Max : 90 jours.")
    else:
        # Avertissement pour le rapport final : l'agent sait que la date n'a pas été vérifiée
        donnees_propres["avertissement_date"] = "Date non vérifiée par l'IA (nécessite un contrôle visuel pour la règle des 3 mois)."

    if not erreurs:
        return {
            "statut":          "APPROUVÉ",
            "message":         "Justificatif conforme (Nom et Adresse vérifiés).",
            "donnees_propres": donnees_propres
        }
    else:
        return {
            "statut":         "REJETÉ",
            "erreurs":        erreurs,
            "donnees_brutes": donnees_justif
        }

def validate_dossier_complet(donnees_cin: dict, donnees_justif: dict) -> dict:
    """
    Validation croisée CIN + Justificatif.
    Vérifie :
      - CIN valide individuellement
      - Justificatif valide individuellement
      - Nom CIN == Nom Justificatif (fuzzy matching, seuil 80)
      - Date justificatif < 3 mois
    """
    print("\n[Validator] Validation dossier complet CIN + Justificatif...")

    erreurs = []

    # ── Validation individuelle ──────────
    result_cin    = validate_cin_dossier(donnees_cin)
    result_justif = validate_justificatif_domicile(donnees_justif)

    if result_cin["statut"] == "REJETÉ":
        erreurs.extend([f"[CIN] {e}" for e in result_cin["erreurs"]])

    if result_justif["statut"] == "REJETÉ":
        erreurs.extend([f"[JUSTIF] {e}" for e in result_justif["erreurs"]])

    # ── Correspondance des noms ──────────
    nom_cin    = donnees_cin.get("nom",     "").strip().lower()
    prenom_cin = donnees_cin.get("prenom", "").strip().lower()
    nom_complet_cin = f"{nom_cin} {prenom_cin}".strip().lower()
    nom_justif = donnees_justif.get("nom",  "").strip().lower()

    if not nom_cin:
        erreurs.append("[CROISÉ] Nom CIN absent — correspondance impossible.")
    elif not nom_justif:
        erreurs.append("[CROISÉ] Nom justificatif absent — correspondance impossible.")
    else:
        score = fuzz.token_sort_ratio(nom_complet_cin, nom_justif)
        print(f"[Validator] Score similarité noms : {score}/100 "
              f"('{nom_complet_cin}' vs '{nom_justif}')")

        if score < 80:
            erreurs.append(
                f"[CROISÉ] Noms discordants (score {score}/100 < 80) : "
                f"CIN='{nom_complet_cin.upper()}' / Justif='{nom_justif.upper()}'"
            )
        else:
            print(f"[Validator] ✅ Noms concordants (score {score}/100)")

    # ── Décision finale ──────────────────
    if not erreurs:
        return {
            "statut":  "APPROUVÉ",
            "message": "Dossier KYC complet et cohérent.",
            "details": {
                "cin":         result_cin.get("donnees_propres", {}),
                "justificatif": result_justif.get("donnees_propres", {}),
                "score_nom":   fuzz.token_sort_ratio(nom_complet_cin, nom_justif)
            }
        }
    else:
        return {
            "statut":  "REJETÉ",
            "erreurs": erreurs,
            "details": {
                "cin":          result_cin,
                "justificatif": result_justif,
            }
        }