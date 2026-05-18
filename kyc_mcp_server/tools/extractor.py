import os
import json
import torch
from PIL import Image


# Imports pour CIN
from ultralytics import YOLO
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

# Imports pour Justificatif (Nouveau Modèle)
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor, BitsAndBytesConfig
from peft import PeftModel

os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_DISABLE_ONEDNN"] = "1"
os.environ["FLAGS_onednn_opt_cache_capacity"] = "0"

# ─────────────────────────────────────────
# MAPPING DES CLASSES (CIN Uniquement)
# ─────────────────────────────────────────
MAPPING_CLASSES_CIN = {
    "cin": "numero_cin",
    "nom": "nom",
    "prenom": "prenom",
    "date_naissance": "date_naissance",
    "date_expiration": "date_expiration",
}

# ─────────────────────────────────────────
# CONFIGURATION DES CHEMINS
# ─────────────────────────────────────────
DOSSIER_ACTUEL = os.path.dirname(os.path.abspath(__file__))
CHEMIN_MODELE_CIN = os.path.normpath(os.path.join(DOSSIER_ACTUEL, "..", "modele_final", "yolo_cnie_maroc_v1.pt"))

# NOUVEAU : Chemin vers votre dossier LoRA généré
CHEMIN_MODELE_QWEN_LORA = os.path.normpath(os.path.join(DOSSIER_ACTUEL, "..", "kyc_qwen_lora_final"))

# ─────────────────────────────────────────
# SINGLETONS
# ─────────────────────────────────────────
_model_yolo_cin = None
_processor_trocr = None
_model_trocr = None

# Nouveaux singletons pour Qwen
_model_qwen = None
_processor_qwen = None

_device = "cuda" if torch.cuda.is_available() else "cpu"


# ─────────────────────────────────────────
# CHARGEMENT DES MODÈLES
# ─────────────────────────────────────────

def _charger_modeles_cin():
    """Charge YOLO CIN + TrOCR."""
    global _model_yolo_cin, _processor_trocr, _model_trocr

    if _model_yolo_cin is None:
        if not os.path.exists(CHEMIN_MODELE_CIN):
            raise FileNotFoundError(f"Modèle CIN introuvable : {CHEMIN_MODELE_CIN}")
        print("[Extractor] Chargement YOLO CIN...")
        _model_yolo_cin = YOLO(CHEMIN_MODELE_CIN)

    if _model_trocr is None:
        print(f"[Extractor] Chargement TrOCR sur {_device}...")
        _processor_trocr = TrOCRProcessor.from_pretrained("microsoft/trocr-base-printed")
        _model_trocr = VisionEncoderDecoderModel.from_pretrained(
            "microsoft/trocr-base-printed"
        ).to(_device)

    return _model_yolo_cin, _processor_trocr, _model_trocr


def _charger_modele_justif_qwen():
    """Charge Qwen2-VL et les poids LoRA pour les justificatifs."""
    global _model_qwen, _processor_qwen

    if _model_qwen is None:
        if not os.path.exists(CHEMIN_MODELE_QWEN_LORA):
            raise FileNotFoundError(f"Dossier LoRA introuvable : {CHEMIN_MODELE_QWEN_LORA}")

        print(f"[Extractor] Chargement de Qwen2-VL + LoRA sur {_device}...")
        model_kwargs = {}

        if _device == "cuda":
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16
            )
            model_kwargs = {
                "quantization_config": bnb_config,
                "device_map": "auto",
            }
        else:
            print("[Extractor] CPU détecté : chargement sans quantization bitsandbytes.")
            model_kwargs = {
                "torch_dtype": torch.float32,
            }

        base_model = Qwen2VLForConditionalGeneration.from_pretrained(
            "Qwen/Qwen2-VL-2B-Instruct",
            **model_kwargs
        )

        # Greffe du cerveau LoRA
        _model_qwen = PeftModel.from_pretrained(base_model, CHEMIN_MODELE_QWEN_LORA)
        _processor_qwen = AutoProcessor.from_pretrained(CHEMIN_MODELE_QWEN_LORA)

    return _model_qwen, _processor_qwen


# ─────────────────────────────────────────
# HELPERS OCR (Pour CIN)
# ─────────────────────────────────────────

def _lire_zone_trocr(image_pil, processor, model_ocr):
    """Lit une zone avec TrOCR (pour CIN)."""
    pixel_values = processor(
        image_pil, return_tensors="pt"
    ).pixel_values.to(_device)
    generated_ids = model_ocr.generate(pixel_values)
    return processor.batch_decode(
        generated_ids, skip_special_tokens=True
    )[0].strip()


# ─────────────────────────────────────────
# EXTRACTION CIN (inchangée)
# ─────────────────────────────────────────

def extract_document(chemin_image: str) -> dict:
    """
    Extraction CIN : YOLO (détection) → TrOCR (lecture).
    """
    print(f"\n[Extractor CIN] Analyse : {chemin_image}")

    if not os.path.exists(chemin_image):
        return {"extraction_status": "FAILED",
                "erreur": f"Fichier introuvable: {chemin_image}"}

    donnees_extraites = {
        "document_type": "CIN",
        "extraction_status": "SUCCESS"
    }

    try:
        yolo, processor, model_ocr = _charger_modeles_cin()
        image_originale = Image.open(chemin_image).convert("RGB")

        # Ajout du NMS (iou=0.4) pour empêcher la double-détection des champs
        resultats_yolo = yolo.predict(
            source=chemin_image,
            conf=0.58,
            iou=0.4,
            verbose=False
        )
        boites = resultats_yolo[0].boxes

        print(f"[Extractor CIN] {len(boites)} zones détectées")

        for boite in boites:
            id_classe = int(boite.cls[0])
            nom_classe = MAPPING_CLASSES_CIN.get(
                yolo.names[id_classe].lower(),
                yolo.names[id_classe].lower()
            )
            x1, y1, x2, y2 = boite.xyxy[0].tolist()
            image_decoupee = image_originale.crop((x1, y1, x2, y2))
            texte_lu = _lire_zone_trocr(
                image_decoupee, processor, model_ocr
            )

            donnees_extraites[nom_classe] = texte_lu

        if len(donnees_extraites) <= 2:
            return {"extraction_status": "FAILED",
                    "erreur": "Aucun champ détecté par YOLO."}

        return donnees_extraites

    except Exception as e:
        print(f"[Extractor CIN - ERREUR] {e}")
        return {"extraction_status": "FAILED", "erreur": str(e)}


# ─────────────────────────────────────────
# EXTRACTION JUSTIFICATIF DE DOMICILE (NOUVELLE VERSION VLM)
# ─────────────────────────────────────────

def extract_justificatif(chemin_image: str) -> dict:
    """
    Extraction justificatif : Modèle multimodal Qwen2-VL fine-tuné.
    Retourne directement un JSON structuré.
    """
    print(f"\n[Extractor Justif VLM] Analyse : {chemin_image}")

    if not os.path.exists(chemin_image):
        return {"extraction_status": "FAILED",
                "erreur": f"Fichier introuvable: {chemin_image}"}

    try:
        model, processor = _charger_modele_justif_qwen()
        image = Image.open(chemin_image).convert("RGB")

        # Le prompt exact utilisé pendant l'entraînement
        prompt_systeme = "Extrais les informations KYC de cette facture. Renvoie le nom du client, l'adresse complète et le fournisseur au format JSON."
        messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt_systeme}]}]

        text_prompt = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(text=[text_prompt], images=[image], padding=True, return_tensors="pt").to(_device)

        print("[Extractor Justif VLM] Inférence en cours...")
        with torch.no_grad():
            generated_ids = model.generate(**inputs, max_new_tokens=150)

        generated_ids_trimmed = [out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)]
        output_text = \
        processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]

        # Nettoyage et parsing du JSON renvoyé par Qwen
        clean_text = output_text.replace("```json", "").replace("```", "").strip()
        resultat_json = json.loads(clean_text)

        # Formatage de la réponse pour correspondre à l'ancienne structure
        return {
            "document_type": "JUSTIFICATIF_DOMICILE",
            "extraction_status": "SUCCESS",
            "nom": resultat_json.get("nom_client"),
            "adresse": resultat_json.get("adresse_complete"),
            "sous_type": resultat_json.get("fournisseur"),
            "date": None  # VLM entraîné sans date, mis à None par défaut
        }

    except json.JSONDecodeError:
        print("[Extractor Justif VLM - ERREUR] Le modèle n'a pas renvoyé de JSON valide.")
        return {"extraction_status": "FAILED", "erreur": "Format JSON invalide en sortie du modèle.",
                "texte_brut": output_text}
    except Exception as e:
        print(f"[Extractor Justif VLM - ERREUR] {e}")
        return {"extraction_status": "FAILED", "erreur": str(e)}
