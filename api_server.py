"""
api_server.py — FastAPI bridge entre le frontend React et l'Agent KYC
Placer ce fichier à la racine du projet : Agent_KYC_demo/api_server.py
Lancer avec : uvicorn api_server:app --port 8000
"""

import os
import sys
import shutil
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

# ── Import des modules KYC ──
sys.path.append(os.path.join(os.path.dirname(__file__), "kyc_mcp_server"))

# On importe uniquement les outils locaux (Pas de double appel MCP/Ollama pour préserver la RAM)
from kyc_mcp_server.tools.extractor import extract_document, extract_justificatif
from kyc_mcp_server.tools.validator import (
    validate_cin_dossier,
    validate_dossier_complet,
    validate_justificatif_domicile
)

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session # Import corrigé pour SQLAlchemy 2.0
from sqlalchemy.sql import func


# ── Base de données SQLite ──
engine = create_engine("sqlite:///./kyc.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Modèles de Données ──
class KYCDossier(Base):
    __tablename__ = "kyc_dossiers"
    id           = Column(Integer, primary_key=True, index=True)
    filename     = Column(String)
    nom          = Column(String)
    prenom       = Column(String)
    cin          = Column(String)
    decision_ia  = Column(String)
    statut       = Column(String, default="PENDING")
    motif        = Column(Text, nullable=True)
    agent_report = Column(Text, nullable=True)
    risk_score   = Column(Integer, nullable=True)
    created_at   = Column(DateTime, default=func.now())
    updated_at   = Column(DateTime, onupdate=func.now())

Base.metadata.create_all(bind=engine)

class DecisionRequest(BaseModel):
    motif: Optional[str] = None

# ── Configuration FastAPI ──
app = FastAPI(title="AWB KYC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Routes API ──

@app.get("/")
def health():
    return {"status": "ok", "service": "AWB KYC API"}

@app.post("/kyc/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    justif: UploadFile = File(...),
):
    """Pipeline complet KYC (Extraction + Validation) optimisé pour 16Go RAM"""

    # Validation MIME
    types_acceptes = ["image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in types_acceptes:
        raise HTTPException(status_code=400, detail="CIN : format non supporté.")
    if justif.content_type not in types_acceptes:
        raise HTTPException(status_code=400, detail="Justificatif : format non supporté.")

    # Sauvegarde temporaire
    chemin_cin    = os.path.join(UPLOAD_DIR, f"cin_{file.filename}")
    chemin_justif = os.path.join(UPLOAD_DIR, f"justif_{justif.filename}")

    try:
        with open(chemin_cin, "wb") as f:
            shutil.copyfileobj(file.file, f)
        with open(chemin_justif, "wb") as f:
            shutil.copyfileobj(justif.file, f)

        # 1 & 2 : Extraction (Charge les modèles en VRAM une seule fois)
        donnees_cin = extract_document(chemin_cin)
        donnees_justif = extract_justificatif(chemin_justif)

        # 3 : Validations
        validation = validate_dossier_complet(donnees_cin, donnees_justif)
        validation_cin = validate_cin_dossier(donnees_cin)
        validation_justif = validate_justificatif_domicile(donnees_justif)

        # 4 : Génération du rapport de l'Agent (Simulé pour préserver la RAM)
        statut = validation.get("statut", "INCONNU")
        erreurs = validation.get("erreurs", [])
        details = validation.get("details", {})

        dp_cin = details.get("cin", {})
        dp_justif = details.get("justificatif", {})
        age_calcule = dp_cin.get("age_calcule") if isinstance(dp_cin, dict) else None

        if statut == "APPROUVÉ":
            texte_agent = (
                f"Décision finale : APPROUVÉ\n\n"
                f"CIN :\n"
                f"  • Nom            : {dp_cin.get('nom', 'N/A')}\n"
                f"  • Prénom         : {dp_cin.get('prenom', 'N/A')}\n"
                f"  • N° CIN         : {dp_cin.get('numero_cin', 'N/A')}\n"
                f"  • Date naissance : {dp_cin.get('date_naissance', 'N/A')}\n\n"
                f"Justificatif :\n"
                f"  • Nom      : {dp_justif.get('nom', 'N/A')}\n"
                f"  • Adresse  : {dp_justif.get('adresse', 'N/A')}\n\n"
                f"Motif : {validation.get('message', 'Aucun')}\n"
                f"Action requise : AUCUNE"
            )
        else:
            errs = "\n".join(f"  • {e}" for e in erreurs)
            texte_agent = f"Décision finale : REJETÉ\n\nMotifs :\n{errs}\n\nAction requise : Vérification manuelle requise par l'opérateur."

        # Construction des métriques pour le Frontend React
        cin_ok = validation_cin.get("statut") == "APPROUVÉ"
        justif_ok = validation_justif.get("statut") == "APPROUVÉ"
        noms_ok = statut == "APPROUVÉ"

        risk_score = 30 if statut == "APPROUVÉ" else 68
        risk_level = "low" if risk_score < 40 else "medium" if risk_score < 70 else "high"

        # 5 : Sauvegarde en base de données
        db = SessionLocal()
        dossier = KYCDossier(
            filename      = file.filename,
            nom           = donnees_cin.get("nom", ""),
            prenom        = donnees_cin.get("prenom", ""),
            cin           = donnees_cin.get("numero_cin", ""),
            decision_ia   = statut,
            statut        = "PENDING",
            agent_report  = texte_agent,
            risk_score    = risk_score,
        )
        db.add(dossier)
        db.commit()
        db.refresh(dossier)
        dossier_id = dossier.id
        db.close()

        # Réponse structurée pour React
        return JSONResponse({
            "status": "success",
            "decision": statut,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "extracted": {
                "nom": donnees_cin.get("nom", ""),
                "prenom": donnees_cin.get("prenom", ""),
                "numero_cin": donnees_cin.get("numero_cin", ""),
                "date_naissance": donnees_cin.get("date_naissance", ""),
                "date_expiration": donnees_cin.get("date_expiration", ""),
                "age": age_calcule,
            },
            "extracted_justif": {
                "nom": donnees_justif.get("nom", ""),
                "adresse": donnees_justif.get("adresse", ""),
                "sous_type": donnees_justif.get("sous_type", ""),
            },
            "checks": {
                "document_authenticity": {"label": "Authenticité Document", "value": "Vérifié" if cin_ok else "Invalide", "status": "success" if cin_ok else "error"},
                "fields_complete": {"label": "Complétude des champs", "value": "OK" if cin_ok else "Incomplet", "status": "success" if cin_ok else "error"},
                "majority_check": {"label": "Majorité (18 ans+)", "value": "OK" if cin_ok else "À vérifier", "status": "success" if cin_ok else "warning"},
                "nom_match": {"label": "Correspondance Noms", "value": "Concordants" if noms_ok else "Discordants", "status": "success" if noms_ok else "error"},
            },
            "dossier_id": dossier_id,
            "errors": erreurs,
            "agent_report": texte_agent,
            "filename": file.filename,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne : {str(e)}")

    finally:
        # Nettoyage sécurisé des fichiers temporaires
        try:
            if os.path.exists(chemin_cin):
                os.remove(chemin_cin)
            if os.path.exists(chemin_justif):
                os.remove(chemin_justif)
        except Exception as cleanup_error:
            print(f"Erreur lors du nettoyage des fichiers temporaires : {cleanup_error}")

# ── Routes de gestion de l'état ──

@app.patch("/kyc/dossiers/{id}/approuver")
def approuver(id: int, body: DecisionRequest, db: Session = Depends(get_db)):
    dossier = db.query(KYCDossier).filter(KYCDossier.id == id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    dossier.statut = "APPROVED"
    dossier.motif = body.motif or "Approuvé manuellement par l'opérateur"
    db.commit()
    return {"message": "Dossier approuvé", "statut": "APPROVED", "id": id}

@app.patch("/kyc/dossiers/{id}/rejeter")
def rejeter(id: int, body: DecisionRequest, db: Session = Depends(get_db)):
    dossier = db.query(KYCDossier).filter(KYCDossier.id == id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    if not body.motif:
        raise HTTPException(status_code=400, detail="Le motif de rejet est obligatoire")
    dossier.statut = "REJECTED"
    dossier.motif = body.motif
    db.commit()
    return {"message": "Dossier rejeté", "statut": "REJECTED", "id": id}

@app.patch("/kyc/dossiers/{id}/escalader")
def escalader(id: int, body: DecisionRequest, db: Session = Depends(get_db)):
    dossier = db.query(KYCDossier).filter(KYCDossier.id == id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    dossier.statut = "ESCALATED"
    dossier.motif = body.motif or "Escaladé pour révision manuelle"
    db.commit()
    return {"message": "Dossier escaladé", "statut": "ESCALATED", "id": id}

if __name__ == "__main__":
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=False)