# -*- coding: utf-8 -*-
"""Phase Export — transforme la table `extraction_corrections` en datasets d'entraînement.

Lit les corrections faites par le Back Office (image + champs corrigés) et produit :
  - datasets/vlm_kyc/     : justificatif (KYC)  -> image entière + JSON corrigé
  - datasets/vlm_cheque/  : chèque manuscrit    -> image entière + JSON corrigé
  - datasets/trocr/       : champs imprimés (CIN, num_compte, cmc7) -> CROP + texte corrigé
                            (les crops sont régénérés en repassant YOLO sur l'image stockée)

Aucune écriture destructive : on marque seulement `exported_at` sur les lignes traitées
(sauf --no-mark) pour ne pas les réexporter au prochain cycle.

Usage :
    python training/export_corrections.py                 # corrections non encore exportées
    python training/export_corrections.py --all           # toutes les corrections
    python training/export_corrections.py --no-trocr      # saute les crops YOLO (pas de modèle chargé)
    python training/export_corrections.py --no-mark       # n'écrit pas exported_at
    python training/export_corrections.py --out chemin    # dossier de sortie

Connexion DB par variables d'env (mêmes défauts que application.properties) :
    DB_HOST=localhost DB_PORT=5432 DB_NAME=kyc_db DB_USER=postgres DB_PASSWORD=postgres
"""

import argparse
import io
import json
import os
import sys
from datetime import datetime

import psycopg2
import psycopg2.extras
from PIL import Image


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))

# ── Prompts d'entraînement : IDENTIQUES à ceux de l'inférence (extractor.py) ──
PROMPT_JUSTIF = ("Extrais les informations KYC de cette facture. Renvoie le nom du "
                 "client, l'adresse complète et le fournisseur au format JSON.")
PROMPT_CHEQUE = ("Lis ce chèque et renvoie UNIQUEMENT un JSON avec les clés "
                 "montant_chiffre, montant_lettre, beneficiaire.")

# ── Le VLM justificatif sort {nom_client, adresse_complete, fournisseur}.
#    Nos corrections sont stockées en {nom, adresse, sous_type} -> on remappe vers
#    le vocabulaire de sortie du modèle pour que la cible d'entraînement soit cohérente.
JUSTIF_KEY_MAP = {"nom": "nom_client", "adresse": "adresse_complete", "sous_type": "fournisseur"}

# ── Le VLM chèque ne lit que ces 3 champs (le reste = TrOCR). ──
CHEQUE_VLM_FIELDS = ["montant_chiffre", "montant_lettre", "beneficiaire"]

# ── TrOCR : champ corrigé -> classe YOLO qui localise sa case sur l'image. ──
CIN_FIELD_TO_YOLO = {
    "numero_cin": "cin", "nom": "nom", "prenom": "prenom",
    "date_naissance": "date_naissance", "date_expiration": "date_expiration",
}
CHEQUE_FIELD_TO_YOLO = {"num_compte": "num_compte", "cmc7": "cmc7"}

YOLO_CIN_WEIGHTS = os.path.join(ROOT, "kyc_mcp_server", "modele_final", "yolo_cnie_maroc_v1.pt")
YOLO_CHEQUE_WEIGHTS = os.path.join(ROOT, "cheque_mcp_server", "modele_final", "best.pt")

# ── Dataset YOLO (correction de la DÉTECTION) : ordre des classes par domaine. ──
# IMPORTANT : pour un fine-tuning qui réutilise les poids, cet ordre doit
# correspondre aux classes du modèle de base (cf. train_yolo.py qui l'affiche).
YOLO_CLASSES = {
    "KYC": ["nom", "prenom", "numero_cin", "date_naissance", "date_expiration"],
    "CHEQUE": ["num_compte", "signature", "cmc7"],
}
YOLO_OUT = {"KYC": "yolo_kyc", "CHEQUE": "yolo_cheque"}

# Cache des modèles YOLO (chargés à la demande, une seule fois).
_yolo_cache = {}


# ─────────────────────────────────────────────────────────────────────────────
# Connexion & lecture DB
# ─────────────────────────────────────────────────────────────────────────────
def _connect():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("DB_NAME", "kyc_db"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "postgres"),
    )


def _fetch_corrections(conn, export_all):
    where = "" if export_all else "WHERE exported_at IS NULL"
    sql = (f"SELECT id, domain, document_type, content_type, image_data, "
           f"corrected_json, boxes_json FROM extraction_corrections {where} ORDER BY corrected_at ASC")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        return cur.fetchall()


def _mark_exported(conn, ids):
    if not ids:
        return
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE extraction_corrections SET exported_at = %s WHERE id = ANY(%s)",
            (datetime.now(), list(ids)),
        )
    conn.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers fichiers / images
# ─────────────────────────────────────────────────────────────────────────────
def _ensure(*parts):
    path = os.path.join(*parts)
    os.makedirs(path, exist_ok=True)
    return path


def _ext(content_type):
    return ".png" if (content_type or "").endswith("png") else ".jpg"


def _append_jsonl(path, record):
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def _load_yolo(weights):
    if weights not in _yolo_cache:
        from ultralytics import YOLO  # import paresseux : pas requis pour le VLM
        _yolo_cache[weights] = YOLO(weights)
    return _yolo_cache[weights]


def _crop_fields(pil_image, weights, field_to_yolo, corrected, conf=0.25):
    """Repasse YOLO sur l'image, récupère la meilleure case par classe demandée,
    et l'apparie au texte corrigé. Renvoie [(field, crop_pil, texte), ...]."""
    yolo = _load_yolo(weights)
    res = yolo.predict(pil_image, conf=conf, iou=0.4, verbose=False)[0]
    names = yolo.names

    # meilleure boîte par nom de classe
    best = {}
    for b in res.boxes:
        cls = names[int(b.cls)]
        cf = float(b.conf)
        if cls not in best or cf > best[cls][1]:
            best[cls] = (b.xyxy[0].tolist(), cf)

    out = []
    for field, yolo_class in field_to_yolo.items():
        texte = corrected.get(field)
        if not texte:                       # champ non corrigé / vide -> pas d'exemple
            continue
        if yolo_class not in best:          # YOLO n'a pas trouvé la case -> relève de la phase YOLO
            continue
        x1, y1, x2, y2 = [int(v) for v in best[yolo_class][0]]
        crop = pil_image.crop((max(0, x1 - 3), max(0, y1 - 3), x2 + 3, y2 + 3))
        out.append((field, crop, str(texte)))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Export d'une correction
# ─────────────────────────────────────────────────────────────────────────────
def _export_row(row, out_dir, do_trocr, stats):
    domain = (row["domain"] or "").upper()
    doctype = (row["document_type"] or "").upper()
    img_bytes = bytes(row["image_data"]) if row["image_data"] is not None else None
    try:
        corrected = json.loads(row["corrected_json"]) if row["corrected_json"] else {}
    except (TypeError, ValueError):
        corrected = {}

    if img_bytes is None:
        stats["skipped_no_image"] += 1
        return
    pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    ext = _ext(row["content_type"])

    # ── VLM justificatif (KYC / JUSTIF) ──
    if domain == "KYC" and doctype == "JUSTIF":
        ds = _ensure(out_dir, "vlm_kyc")
        img_rel = os.path.join("images", f"corr_{row['id']}{ext}")
        pil.save(os.path.join(_ensure(ds, "images"), os.path.basename(img_rel)))
        target = {JUSTIF_KEY_MAP[k]: corrected.get(k, "") for k in JUSTIF_KEY_MAP}
        _append_jsonl(os.path.join(ds, "data.jsonl"),
                      {"image": img_rel, "prompt": PROMPT_JUSTIF, "target": target})
        stats["vlm_kyc"] += 1

    # ── VLM chèque + TrOCR chèque (CHEQUE / CHEQUE) ──
    elif domain == "CHEQUE" and doctype == "CHEQUE":
        ds = _ensure(out_dir, "vlm_cheque")
        img_rel = os.path.join("images", f"corr_{row['id']}{ext}")
        pil.save(os.path.join(_ensure(ds, "images"), os.path.basename(img_rel)))
        target = {k: corrected.get(k, "") for k in CHEQUE_VLM_FIELDS}
        _append_jsonl(os.path.join(ds, "data.jsonl"),
                      {"image": img_rel, "prompt": PROMPT_CHEQUE, "target": target})
        stats["vlm_cheque"] += 1
        if do_trocr:
            _export_trocr(pil, YOLO_CHEQUE_WEIGHTS, CHEQUE_FIELD_TO_YOLO, corrected,
                          row, out_dir, domain, stats)

    # ── TrOCR CIN (KYC / CIN) ──
    elif domain == "KYC" and doctype == "CIN":
        if do_trocr:
            _export_trocr(pil, YOLO_CIN_WEIGHTS, CIN_FIELD_TO_YOLO, corrected,
                          row, out_dir, domain, stats)
        else:
            stats["trocr_skipped"] += 1
    else:
        stats["skipped_unknown"] += 1

    # ── Dataset YOLO (boîtes corrigées) — pour TOUTE ligne qui en a ──
    try:
        boxes = json.loads(row["boxes_json"]) if row["boxes_json"] else {}
    except (TypeError, ValueError):
        boxes = {}
    if boxes:
        _export_yolo(row, out_dir, domain, boxes, pil, stats)


def _write_data_yaml(ds_dir, classes):
    names = "[" + ", ".join(f"'{c}'" for c in classes) + "]"
    # Chemin en slashs avant (Windows : éviter les backslashes mal interprétés en YAML).
    abs_path = os.path.abspath(ds_dir).replace("\\", "/")
    content = (f"path: {abs_path}\n"
               f"train: images\nval: images\n"
               f"nc: {len(classes)}\nnames: {names}\n")
    with open(os.path.join(ds_dir, "data.yaml"), "w", encoding="utf-8") as fh:
        fh.write(content)


def _export_yolo(row, out_dir, domain, boxes, pil, stats):
    """Écrit (image + label normalisé YOLO) à partir des boîtes corrigées."""
    classes = YOLO_CLASSES.get(domain)
    if not classes:
        return
    ds = _ensure(out_dir, YOLO_OUT[domain])
    img_dir = _ensure(ds, "images")
    lbl_dir = _ensure(ds, "labels")
    W, H = pil.size
    stem = f"corr_{row['id']}"
    pil.save(os.path.join(img_dir, stem + ".jpg"), "JPEG", quality=95)

    lines = []
    for cls, box in boxes.items():
        if cls not in classes or not (isinstance(box, list) and len(box) == 4):
            continue
        x1, y1, x2, y2 = box
        cx = ((x1 + x2) / 2) / W
        cy = ((y1 + y2) / 2) / H
        w = abs(x2 - x1) / W
        h = abs(y2 - y1) / H
        lines.append(f"{classes.index(cls)} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")

    with open(os.path.join(lbl_dir, stem + ".txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    _write_data_yaml(ds, classes)
    stats["yolo"] += len(lines)


def _export_trocr(pil, weights, field_to_yolo, corrected, row, out_dir, domain, stats):
    try:
        crops = _crop_fields(pil, weights, field_to_yolo, corrected)
    except Exception as exc:
        print(f"  [TrOCR] crop ignoré (id={row['id']}): {exc}", file=sys.stderr)
        stats["trocr_failed"] += 1
        return
    ds = _ensure(out_dir, "trocr")
    img_dir = _ensure(ds, "images")
    for field, crop, texte in crops:
        name = f"corr_{row['id']}_{field}.png"
        crop.save(os.path.join(img_dir, name))
        _append_jsonl(os.path.join(ds, "data.jsonl"),
                      {"image": os.path.join("images", name), "text": texte,
                       "field": field, "domain": domain})
        stats["trocr"] += 1


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Export des corrections -> datasets")
    parser.add_argument("--all", action="store_true", help="Exporter aussi les corrections déjà exportées.")
    parser.add_argument("--no-trocr", action="store_true", help="Ne pas générer les crops TrOCR (pas de YOLO).")
    parser.add_argument("--no-mark", action="store_true", help="Ne pas marquer exported_at.")
    # NB: surtout PAS "datasets" -> ce nom masquerait la lib HuggingFace `datasets`
    # importée par transformers.Trainer (collision de module au runtime).
    parser.add_argument("--out", default=os.path.join(HERE, "data"), help="Dossier de sortie.")
    args = parser.parse_args()

    conn = _connect()
    try:
        rows = _fetch_corrections(conn, args.all)
        print(f"{len(rows)} correction(s) à exporter -> {args.out}")
        if not rows:
            return

        stats = {k: 0 for k in ("vlm_kyc", "vlm_cheque", "trocr", "yolo", "trocr_failed",
                                "trocr_skipped", "skipped_no_image", "skipped_unknown")}
        processed_ids = []
        for row in rows:
            _export_row(row, args.out, not args.no_trocr, stats)
            processed_ids.append(row["id"])

        if not args.no_mark:
            _mark_exported(conn, processed_ids)

        print("\n=== Résumé ===")
        print(f"  VLM KYC (justificatif) : {stats['vlm_kyc']} exemple(s)")
        print(f"  VLM Chèque (manuscrit) : {stats['vlm_cheque']} exemple(s)")
        print(f"  TrOCR (crops)          : {stats['trocr']} exemple(s)")
        print(f"  YOLO (boîtes)          : {stats['yolo']} boîte(s)")
        if stats["trocr_failed"]:
            print(f"  TrOCR échecs           : {stats['trocr_failed']}")
        if stats["skipped_no_image"]:
            print(f"  Ignorés (sans image)   : {stats['skipped_no_image']}")
        print(f"  Marquées exportées     : {0 if args.no_mark else len(processed_ids)}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
