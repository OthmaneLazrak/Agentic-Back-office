# -*- coding: utf-8 -*-
"""Phase Réentraînement — fine-tune YOLO sur les boîtes corrigées par le Back Office.

Repart des poids de production et réentraîne sur le dataset YOLO produit par
export_corrections.py (datasets/data/yolo_kyc ou yolo_cheque).

Exemples :
    # CIN (KYC)
    python training/train_yolo.py --data training/data/yolo_kyc/data.yaml \
        --base kyc_mcp_server/modele_final/yolo_cnie_maroc_v1.pt \
        --out kyc_mcp_server/modele_final/yolo_cnie_v2.pt --epochs 50

    # Chèque
    python training/train_yolo.py --data training/data/yolo_cheque/data.yaml \
        --base cheque_mcp_server/modele_final/best.pt \
        --out cheque_mcp_server/modele_final/best_v2.pt --epochs 50

    # Vérifier l'ordre des classes du modèle de base (doit matcher data.yaml) :
    python training/train_yolo.py --data ... --base ... --out ... --print-classes
"""

import argparse
import os
import shutil


def main():
    ap = argparse.ArgumentParser(description="Fine-tune YOLO sur les boîtes corrigées")
    ap.add_argument("--data", required=True, help="Chemin du data.yaml (dossier yolo_*).")
    ap.add_argument("--base", required=True, help="Poids YOLO de départ (.pt).")
    ap.add_argument("--out", required=True, help="Fichier .pt de sortie (nouvelle version).")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--print-classes", action="store_true",
                    help="Afficher les classes du modèle de base puis quitter.")
    ap.add_argument("--smoke", action="store_true", help="1 epoch, pour valider le pipeline.")
    args = ap.parse_args()

    from ultralytics import YOLO

    model = YOLO(args.base)
    # L'ordre des classes du modèle de base DOIT correspondre à data.yaml pour
    # que le fine-tuning réutilise correctement la tête de détection.
    print("[YOLO] Classes du modèle de base :", model.names)
    if args.print_classes:
        return

    results = model.train(
        data=args.data,
        epochs=1 if args.smoke else args.epochs,
        imgsz=args.imgsz,
        project=os.path.join(os.path.dirname(args.out) or ".", "_yolo_runs"),
        name="finetune",
        exist_ok=True,
        verbose=True,
    )

    # Récupère les meilleurs poids et les copie vers --out (versionné).
    best = getattr(model.trainer, "best", None)
    if best and os.path.isfile(best):
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        shutil.copy(best, args.out)
        print(f"\n[OK] Poids YOLO enregistrés -> {args.out}")
        print("     Pointer le MCP dessus via variable d'env puis redémarrer "
              "(KYC_YOLO_WEIGHTS / CHEQUE_YOLO_WEIGHTS).")
    else:
        print("\n[ATTENTION] best.pt introuvable — voir le dossier _yolo_runs.")


if __name__ == "__main__":
    main()
