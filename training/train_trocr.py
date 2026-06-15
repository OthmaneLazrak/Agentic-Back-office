# -*- coding: utf-8 -*-
"""Phase Réentraînement — fine-tune TrOCR sur les crops corrigés (num_compte, cmc7, champs CIN).

TrOCR lit un CROP (la case d'un champ) et produit son TEXTE. On l'affine sur les
paires (crop -> texte corrigé) générées par export_corrections.py dans datasets/trocr.

Exemple :
    python training/train_trocr.py --dataset training/datasets/trocr \
        --out kyc_mcp_server/trocr_v2 --epochs 5

    python training/train_trocr.py --dataset training/datasets/trocr --out /tmp/t2 --smoke
"""

import argparse
import json
import os

import torch
from PIL import Image
from torch.utils.data import Dataset

BASE_DEFAULT = "microsoft/trocr-base-printed"


class TrocrDataset(Dataset):
    def __init__(self, dataset_dir):
        self.dir = dataset_dir
        path = os.path.join(dataset_dir, "data.jsonl")
        if not os.path.isfile(path):
            raise FileNotFoundError(f"data.jsonl introuvable: {path}")
        with open(path, encoding="utf-8") as fh:
            self.rows = [json.loads(line) for line in fh if line.strip()]
        if not self.rows:
            raise ValueError(f"Dataset vide: {path}")

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        return {"image_path": os.path.join(self.dir, r["image"]), "text": str(r["text"])}


class TrocrCollator:
    """Image -> pixel_values ; texte -> labels (token ids, padding masqué à -100)."""
    def __init__(self, processor, max_len=64):
        self.processor = processor
        self.max_len = max_len

    def __call__(self, batch):
        images = [Image.open(ex["image_path"]).convert("RGB") for ex in batch]
        texts = [ex["text"] for ex in batch]
        pixel_values = self.processor(images=images, return_tensors="pt").pixel_values
        labels = self.processor.tokenizer(
            texts, padding="max_length", truncation=True, max_length=self.max_len,
            return_tensors="pt").input_ids
        # le padding ne doit pas compter dans la loss
        labels[labels == self.processor.tokenizer.pad_token_id] = -100
        return {"pixel_values": pixel_values, "labels": labels}


def main():
    ap = argparse.ArgumentParser(description="Fine-tune TrOCR sur les crops corrigés")
    ap.add_argument("--dataset", required=True, help="Dossier datasets/trocr.")
    ap.add_argument("--base", default=BASE_DEFAULT, help="Modèle TrOCR de départ (ou version précédente).")
    ap.add_argument("--out", required=True, help="Dossier de sortie du modèle.")
    ap.add_argument("--epochs", type=float, default=5.0)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--smoke", action="store_true", help="1 seul pas, pour valider le pipeline.")
    args = ap.parse_args()

    from transformers import (TrOCRProcessor, VisionEncoderDecoderModel,
                              Trainer, TrainingArguments)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = TrOCRProcessor.from_pretrained(args.base)
    model = VisionEncoderDecoderModel.from_pretrained(args.base).to(device)

    # Jetons spéciaux (nécessaires pour la génération encoder-decoder).
    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.vocab_size = model.config.decoder.vocab_size

    train_ds = TrocrDataset(args.dataset)
    collator = TrocrCollator(processor)
    print(f"[Données] {len(train_ds)} crop(s) depuis {args.dataset}")

    targs = TrainingArguments(
        output_dir=os.path.join(args.out, "_checkpoints"),
        per_device_train_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        max_steps=1 if args.smoke else -1,
        learning_rate=args.lr,
        fp16=(device == "cuda"),
        logging_steps=1,
        save_strategy="no",
        report_to="none",
        remove_unused_columns=False,
    )
    trainer = Trainer(model=model, args=targs, train_dataset=train_ds, data_collator=collator)
    trainer.train()

    os.makedirs(args.out, exist_ok=True)
    model.save_pretrained(args.out)
    processor.save_pretrained(args.out)
    print(f"\n[OK] TrOCR enregistré -> {args.out}")


if __name__ == "__main__":
    main()
