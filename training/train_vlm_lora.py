# -*- coding: utf-8 -*-
"""Phase Réentraînement — fine-tune l'adaptateur LoRA de Qwen2-VL sur les corrections.

Le modèle de BASE (Qwen2-VL-2B) reste GELÉ et chargé en 4-bit (QLoRA) pour tenir
sur 6 Go ; on n'entraîne que le petit adaptateur LoRA (quelques Mo). On peut
CONTINUER depuis l'adaptateur de production (--resume-from) pour ne pas perdre
ce qu'il sait déjà.

Datasets attendus (produits par export_corrections.py) :
    datasets/vlm_kyc/    -> adaptateur justificatif KYC
    datasets/vlm_cheque/ -> adaptateur manuscrit chèque
Chaque ligne data.jsonl : {"image": "...", "prompt": "...", "target": {...}}

Exemple (KYC, en repartant de l'adaptateur actuel) :
    python training/train_vlm_lora.py \
        --dataset training/datasets/vlm_kyc \
        --resume-from kyc_mcp_server/kyc_qwen_lora_final \
        --out kyc_mcp_server/kyc_qwen_lora_v2 --epochs 3

    # Vérifier que le pipeline démarre sans tout entraîner :
    python training/train_vlm_lora.py --dataset training/datasets/vlm_kyc --out /tmp/v2 --smoke
"""

import argparse
import json
import os

import torch
from PIL import Image
from torch.utils.data import Dataset

BASE_DEFAULT = "Qwen/Qwen2-VL-2B-Instruct"


# ── Dataset : lit data.jsonl, renvoie les champs bruts (le collator fait le reste) ──
class VlmCorrectionDataset(Dataset):
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
        return {
            "image_path": os.path.join(self.dir, r["image"]),
            "prompt": r["prompt"],
            "target": json.dumps(r["target"], ensure_ascii=False),
        }


# ── Collator : construit (image + prompt + réponse), masque le prompt dans les labels ──
# On n'apprend QUE sur la réponse (le JSON corrigé), pas sur le prompt.
class VlmCollator:
    def __init__(self, processor):
        self.processor = processor

    def _messages(self, prompt, target=None):
        user = {"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt}]}
        if target is None:
            return [user]
        return [user, {"role": "assistant", "content": [{"type": "text", "text": target}]}]

    def __call__(self, batch):
        images, texts_full, texts_prompt = [], [], []
        for ex in batch:
            images.append(Image.open(ex["image_path"]).convert("RGB"))
            texts_full.append(self.processor.apply_chat_template(
                self._messages(ex["prompt"], ex["target"]), tokenize=False, add_generation_prompt=False))
            texts_prompt.append(self.processor.apply_chat_template(
                self._messages(ex["prompt"]), tokenize=False, add_generation_prompt=True))

        inputs = self.processor(text=texts_full, images=images, padding=True, return_tensors="pt")
        labels = inputs["input_ids"].clone()

        # Masque le préfixe "prompt" (longueur = tokens du prompt seul, image incluse).
        for i, (img, tp) in enumerate(zip(images, texts_prompt)):
            plen = self.processor(text=[tp], images=[img], return_tensors="pt")["input_ids"].shape[1]
            labels[i, :plen] = -100
        labels[inputs["attention_mask"] == 0] = -100   # ignore le padding
        inputs["labels"] = labels
        return inputs


def main():
    ap = argparse.ArgumentParser(description="Fine-tune LoRA Qwen2-VL sur les corrections")
    ap.add_argument("--dataset", required=True, help="Dossier dataset (vlm_kyc / vlm_cheque).")
    ap.add_argument("--base", default=BASE_DEFAULT, help="Modèle de base Qwen2-VL.")
    ap.add_argument("--resume-from", default=None, help="Adaptateur LoRA existant à continuer.")
    ap.add_argument("--out", required=True, help="Dossier de sortie du nouvel adaptateur.")
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--batch-size", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=8)
    ap.add_argument("--smoke", action="store_true", help="1 seul pas, pour valider le pipeline.")
    args = ap.parse_args()

    from transformers import (Qwen2VLForConditionalGeneration, AutoProcessor,
                              BitsAndBytesConfig, Trainer, TrainingArguments)
    from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training

    if not torch.cuda.is_available():
        raise SystemExit("GPU CUDA requis pour l'entraînement QLoRA.")

    # 1) Processor (padding à droite pour que le masque du prompt soit un préfixe).
    processor = AutoProcessor.from_pretrained(args.base)
    processor.tokenizer.padding_side = "right"

    # 2) Modèle de base en 4-bit (QLoRA) -> tient sur 6 Go, poids gelés.
    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                             bnb_4bit_compute_dtype=torch.bfloat16)
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        args.base, quantization_config=bnb, device_map="auto")
    model = prepare_model_for_kbit_training(model)
    model.config.use_cache = False
    model.gradient_checkpointing_enable()

    # 3) Adaptateur LoRA : on CONTINUE l'existant, ou on en crée un neuf (même config que prod).
    if args.resume_from and os.path.isdir(args.resume_from):
        print(f"[LoRA] Poursuite de l'adaptateur: {args.resume_from}")
        model = PeftModel.from_pretrained(model, args.resume_from, is_trainable=True)
    else:
        print("[LoRA] Nouvel adaptateur (r=16, alpha=32, q/k/v/o_proj)")
        model = get_peft_model(model, LoraConfig(
            r=16, lora_alpha=32, lora_dropout=0.05,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
            task_type="CAUSAL_LM"))
    model.print_trainable_parameters()

    # 4) Données.
    train_ds = VlmCorrectionDataset(args.dataset)
    collator = VlmCollator(processor)
    print(f"[Données] {len(train_ds)} exemple(s) depuis {args.dataset}")

    # 5) Entraînement.
    targs = TrainingArguments(
        output_dir=os.path.join(args.out, "_checkpoints"),
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        num_train_epochs=args.epochs,
        max_steps=1 if args.smoke else -1,
        learning_rate=args.lr,
        bf16=True,
        gradient_checkpointing=True,
        logging_steps=1,
        save_strategy="no",
        report_to="none",
        remove_unused_columns=False,        # indispensable : notre collator gère tout
        optim="paged_adamw_8bit",           # optimiseur 8-bit -> économise la VRAM
    )
    trainer = Trainer(model=model, args=targs, train_dataset=train_ds, data_collator=collator)
    trainer.train()

    # 6) Sauvegarde de l'adaptateur versionné (+ processor pour le rechargement).
    os.makedirs(args.out, exist_ok=True)
    model.save_pretrained(args.out)
    processor.save_pretrained(args.out)
    print(f"\n[OK] Adaptateur enregistré -> {args.out}")
    print("     Pointer le MCP dessus via variable d'env puis redémarrer (voir extractor.py).")


if __name__ == "__main__":
    main()
