# -*- coding: utf-8 -*-
"""Extraction des données d'un chèque (modèles lourds + lecture).

Calqué sur ``kyc_mcp_server/tools/extractor.py`` :
  * chargement des modèles en singletons (un seul chargement, réutilisé)
  * une fonction d'extraction "manuscrit"  (Qwen2-VL + LoRA)  -> montants, bénéficiaire
  * une fonction d'extraction "zones"      (YOLO + TrOCR)      -> num_compte, signature, cmc7

Optimisations conservées depuis l'ancien ``cheque_pipeline`` :
  * crops YOLO traités EN MÉMOIRE (pas de relecture disque pour l'OCR)
  * TrOCR exécuté en BATCH (un seul passage pour num_compte + cmc7)
  * torch.inference_mode + greedy decoding (num_beams=1)
  * NMS (iou) sur YOLO pour éviter les doubles détections
"""
import os
import re
import json

import torch

# ─────────────────────────────────────────
# CONFIGURATION DES CHEMINS / MODÈLES
# ─────────────────────────────────────────
DOSSIER_ACTUEL = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.abspath(os.path.join(DOSSIER_ACTUEL, ".."))

VLM_BASE = os.environ.get("CHEQUE_VLM_BASE", "Qwen/Qwen2-VL-2B-Instruct")

# Chemins surchargeables par variable d'env -> SWAP vers une version réentraînée
# sans toucher au code (cf. training/). Défauts = modèles de production.
CHEMIN_MODELE_VLM_LORA = os.environ.get("CHEQUE_VLM_ADAPTER") or \
    os.path.normpath(os.path.join(SERVER_DIR, "cheque_qwen_lora_final"))
CHEMIN_MODELE_YOLO = os.environ.get("CHEQUE_YOLO_WEIGHTS") or \
    os.path.normpath(os.path.join(SERVER_DIR, "modele_final", "best.pt"))
CROP_DIR = os.path.normpath(os.path.join(SERVER_DIR, "crops"))

# Texte imprimé (num_compte, cmc7). Manuscrit -> "microsoft/trocr-base-handwritten".
TROCR_MODEL = os.environ.get("CHEQUE_TROCR_MODEL", "microsoft/trocr-base-printed")

YOLO_NAMES = ["num_compte", "signature", "cmc7"]
PROMPT_VLM = (
    "Lis ce chèque et renvoie UNIQUEMENT un JSON avec les clés "
    "montant_chiffre, montant_lettre, beneficiaire."
)

# ─────────────────────────────────────────
# SINGLETONS
# ─────────────────────────────────────────
_model_vlm = None
_processor_vlm = None

_model_yolo = None

_model_trocr = None
_processor_trocr = None

_device = "cuda" if torch.cuda.is_available() else "cpu"


# ─────────────────────────────────────────
# CHARGEMENT DES MODÈLES
# ─────────────────────────────────────────

def _charger_modele_vlm():
    """Charge Qwen2-VL et les poids LoRA pour la lecture du manuscrit."""
    global _model_vlm, _processor_vlm

    if _model_vlm is None:
        if not os.path.exists(CHEMIN_MODELE_VLM_LORA):
            raise FileNotFoundError(f"Dossier LoRA introuvable : {CHEMIN_MODELE_VLM_LORA}")

        from transformers import (
            Qwen2VLForConditionalGeneration,
            AutoProcessor,
            BitsAndBytesConfig,
        )
        from peft import PeftModel

        print(f"[Extractor] Chargement de Qwen2-VL + LoRA sur {_device}...")
        model_kwargs = {}

        if _device == "cuda":
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16,
            )
            model_kwargs = {
                "quantization_config": bnb_config,
                "device_map": "auto",
            }
        else:
            # Sur CPU, float32 par défaut pour une sortie JSON stable du VLM.
            # Override via env : CHEQUE_VLM_DTYPE=fp32 (défaut) | fp16 | bf16.
            dtype_choice = os.environ.get("CHEQUE_VLM_DTYPE", "fp32").lower()
            dtype_map = {
                "fp32": torch.float32,
                "fp16": torch.float16,
                "bf16": torch.bfloat16,
            }
            cpu_dtype = dtype_map.get(dtype_choice, torch.float32)
            print(f"[Extractor] CPU détecté : chargement en {cpu_dtype} (sans bitsandbytes).")
            model_kwargs = {
                "torch_dtype": cpu_dtype,
                "low_cpu_mem_usage": True,
            }

        base_model = Qwen2VLForConditionalGeneration.from_pretrained(VLM_BASE, **model_kwargs)
        _model_vlm = PeftModel.from_pretrained(base_model, CHEMIN_MODELE_VLM_LORA)
        _processor_vlm = AutoProcessor.from_pretrained(VLM_BASE)
        _model_vlm.eval()

    return _model_vlm, _processor_vlm


def _charger_modele_yolo():
    """Charge YOLO (détection des zones num_compte / signature / cmc7)."""
    global _model_yolo

    if _model_yolo is None:
        if not os.path.exists(CHEMIN_MODELE_YOLO):
            raise FileNotFoundError(f"Modèle YOLO introuvable : {CHEMIN_MODELE_YOLO}")
        from ultralytics import YOLO

        print("[Extractor] Chargement YOLO chèque...")
        _model_yolo = YOLO(CHEMIN_MODELE_YOLO)

    return _model_yolo


def liberer_modeles():
    """Libère les modèles chèque (Qwen-VL/LoRA + YOLO + TrOCR) de la VRAM/RAM.

    Utilisé par l'agent orchestrateur pour laisser la place à un autre agent
    (KYC) sur un GPU à VRAM limitée : un seul VLM résident à la fois.
    """
    global _model_vlm, _processor_vlm, _model_yolo, _model_trocr, _processor_trocr
    _model_vlm = None
    _processor_vlm = None
    _model_yolo = None
    _model_trocr = None
    _processor_trocr = None

    import gc
    gc.collect()
    try:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass
    print("[Extractor] Modèles chèque libérés (VRAM/RAM).")


def _charger_modele_trocr():
    """Charge TrOCR (lecture du texte imprimé : num_compte, cmc7)."""
    global _model_trocr, _processor_trocr

    if _model_trocr is None:
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        print(f"[Extractor] Chargement TrOCR sur {_device}...")
        _processor_trocr = TrOCRProcessor.from_pretrained(TROCR_MODEL)
        _model_trocr = VisionEncoderDecoderModel.from_pretrained(TROCR_MODEL).to(_device)
        _model_trocr.eval()

    return _model_trocr, _processor_trocr


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def _extract_json(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def _lire_trocr_batch(images_pil):
    """OCR de plusieurs crops PIL en UN SEUL passage. Renvoie une liste de textes (même ordre)."""
    if not images_pil:
        return []
    model_ocr, processor = _charger_modele_trocr()
    pixel_values = processor(images=images_pil, return_tensors="pt").pixel_values.to(_device)
    with torch.inference_mode():
        gen = model_ocr.generate(pixel_values, max_new_tokens=64, num_beams=1)
    return [t.strip() for t in processor.batch_decode(gen, skip_special_tokens=True)]


def _nettoyer_num_compte(txt):
    if not txt:
        return None
    digits = re.sub(r"[^\d]", "", txt)
    return digits or txt


# ─────────────────────────────────────────
# EXTRACTION MANUSCRIT (Qwen2-VL + LoRA)
# ─────────────────────────────────────────

def extract_manuscrit(chemin_image: str) -> dict:
    """Lecture du manuscrit : montant (chiffres/lettres) + bénéficiaire via le VLM."""
    print(f"\n[Extractor Manuscrit] Analyse : {chemin_image}")

    if not os.path.exists(chemin_image):
        return {"extraction_status": "FAILED", "erreur": f"Fichier introuvable: {chemin_image}"}

    try:
        from PIL import Image

        model, processor = _charger_modele_vlm()
        chat = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": PROMPT_VLM}]}]
        text = processor.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)
        img = Image.open(chemin_image).convert("RGB")
        inp = processor(text=[text], images=[img], return_tensors="pt", padding=True).to(model.device)

        print("[Extractor Manuscrit] Inférence en cours...")
        with torch.inference_mode():
            gen = model.generate(**inp, max_new_tokens=128, do_sample=False, num_beams=1)
        raw = processor.decode(gen[0][inp.input_ids.shape[1]:], skip_special_tokens=True)
        j = _extract_json(raw)

        return {
            "extraction_status": "SUCCESS",
            "montant_chiffre": j.get("montant_chiffre"),
            "montant_lettre": j.get("montant_lettre"),
            "beneficiaire": j.get("beneficiaire"),
        }
    except Exception as e:
        print(f"[Extractor Manuscrit - ERREUR] {e}")
        return {"extraction_status": "FAILED", "erreur": str(e)}


# ─────────────────────────────────────────
# EXTRACTION ZONES (YOLO + TrOCR)
# ─────────────────────────────────────────

def extract_zones(chemin_image: str, conf: float = 0.25) -> dict:
    """Détecte les zones (num_compte, signature, cmc7), sauvegarde les crops et
    lit le texte imprimé (num_compte + cmc7) via TrOCR batché en mémoire.

    Renvoie toujours les trois clés ; ``crop=None`` quand la zone n'est pas détectée.
    """
    print(f"\n[Extractor Zones] Analyse : {chemin_image}")

    if not os.path.exists(chemin_image):
        return {"extraction_status": "FAILED", "erreur": f"Fichier introuvable: {chemin_image}"}

    try:
        from PIL import Image

        yolo = _charger_modele_yolo()
        im = Image.open(chemin_image).convert("RGB")
        stem = os.path.splitext(os.path.basename(chemin_image))[0]

        # iou=0.4 -> NMS : évite la double détection d'une même zone
        res = yolo.predict(chemin_image, conf=conf, iou=0.4, verbose=False)[0]
        names = yolo.names

        best = {}
        for b in res.boxes:
            cls = names[int(b.cls)]
            cf = float(b.conf)
            if cls not in best or cf > best[cls][1]:
                best[cls] = (b.xyxy[0].tolist(), cf)

        detections = {}
        crops_pil = {}
        for cls, (xy, cf) in best.items():
            x1, y1, x2, y2 = [int(v) for v in xy]
            crop_img = im.crop((max(0, x1 - 3), max(0, y1 - 3), x2 + 3, y2 + 3))
            os.makedirs(os.path.join(CROP_DIR, cls), exist_ok=True)
            cpath = os.path.join(CROP_DIR, cls, f"{stem}__{cls}.png")
            crop_img.save(cpath)
            detections[cls] = {"conf": round(cf, 3), "box": [x1, y1, x2, y2], "crop": cpath}
            crops_pil[cls] = crop_img

        print(f"[Extractor Zones] {len(detections)} zone(s) détectée(s) : {list(detections)}")

        # --- OCR TrOCR batché sur les crops en mémoire ---
        cibles = [c for c in ("num_compte", "cmc7") if c in crops_pil]
        textes = dict(zip(cibles, _lire_trocr_batch([crops_pil[c] for c in cibles])))
        num_compte_text = _nettoyer_num_compte(textes.get("num_compte"))
        cmc7_text = textes.get("cmc7") or None

        return {
            "extraction_status": "SUCCESS",
            "_image_size": list(im.size),   # [largeur, hauteur] (pour correction YOLO)
            "num_compte": {
                "crop": detections.get("num_compte", {}).get("crop"),
                "conf": detections.get("num_compte", {}).get("conf"),
                "box": detections.get("num_compte", {}).get("box"),
                "text": num_compte_text,
            },
            "cmc7": {
                "crop": detections.get("cmc7", {}).get("crop"),
                "conf": detections.get("cmc7", {}).get("conf"),
                "box": detections.get("cmc7", {}).get("box"),
                "text": cmc7_text,
            },
            "signature": {
                "crop": detections.get("signature", {}).get("crop"),
                "conf": detections.get("signature", {}).get("conf"),
                "box": detections.get("signature", {}).get("box"),
                "present": "signature" in detections,
                "match": None,
            },
        }
    except Exception as e:
        print(f"[Extractor Zones - ERREUR] {e}")
        return {"extraction_status": "FAILED", "erreur": str(e)}
