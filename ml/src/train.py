# ML/src/train.py
import os
import sys
import json
import math
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR, ReduceLROnPlateau
from yaml import safe_load

# Ensure src/ is on path
sys.path.insert(0, os.path.dirname(__file__))
from dataset import get_data_loaders
from model import MyModel
from utils import calculate_metrics, save_model


def warmup_lr(epoch, warmup_epochs, base_lr):
    """Linear warmup learning rate."""
    if epoch < warmup_epochs:
        return base_lr * (epoch + 1) / warmup_epochs
    return base_lr


def main():
    # ── Config ────────────────────────────────────────────────────────────
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    with open(config_path) as f:
        config = safe_load(f)

    device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')
    print(f"[INFO] Training on: {device}")

    # ── Data ──────────────────────────────────────────────────────────────
    use_mixup = config.get('mixup_alpha', 0) > 0
    train_loader, val_loader, classes, class_weights = get_data_loaders(use_mixup=use_mixup)
    num_classes = len(classes)
    print(f"[INFO] Classes ({num_classes}): {classes}")

    # ── Model ─────────────────────────────────────────────────────────────
    model = MyModel(
        num_classes=num_classes,
        model_name=config.get('model_name', 'efficientnet_b3'),
        pretrained=True,
        dropout=0.3
    ).to(device)

    trainable, total = model.get_trainable_params()
    print(f"[INFO] Model parameters: {trainable:,} trainable / {total:,} total")

    # ── Loss, Optimizer ───────────────────────────────────────────────────
    class_weights = class_weights.to(device)
    criterion = nn.CrossEntropyLoss(
        weight=class_weights,
        label_smoothing=config.get('label_smoothing', 0.1)
    )

    num_epochs = config['num_epochs']
    warmup_epochs = config.get('warmup_epochs', 5)
    accumulation_steps = config.get('accumulation_steps', 2)
    mixup_alpha = config.get('mixup_alpha', 0.2) if use_mixup else 0.0

    # Start with backbone frozen during warmup
    model.freeze_backbone()

    optimizer = optim.AdamW(
        model.parameters(),
        lr=config['learning_rate'],
        weight_decay=config.get('weight_decay', 0.01)
    )

    # Cosine annealing after warmup
    scheduler_cosine = CosineAnnealingLR(
        optimizer,
        T_max=num_epochs - warmup_epochs,
        eta_min=1e-6
    )

    # Plateau-based backup scheduler
    scheduler_plateau = ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=4, min_lr=1e-7
    )

    def mixup_criterion(pred, y_a, y_b, lam):
        """Mixup loss: weighted combination of two cross-entropy losses."""
        return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)

    # ── Training Loop ─────────────────────────────────────────────────────
    best_val_acc = 0.0
    best_val_loss = float('inf')
    patience = config.get('early_stopping_patience', 12)
    patience_counter = 0
    history = []

    print(f"\n{'='*70}")
    print(f"  Training Configuration:")
    print(f"  Epochs: {num_epochs} | Warmup: {warmup_epochs} | Patience: {patience}")
    print(f"  LR: {config['learning_rate']} | Weight Decay: {config.get('weight_decay', 0.01)}")
    print(f"  Mixup Alpha: {mixup_alpha} | Accumulation Steps: {accumulation_steps}")
    print(f"  Image Size: {config['image_size']}x{config['image_size']}")
    print(f"{'='*70}\n")

    for epoch in range(num_epochs):
        # ── Warmup phase: adjust LR and unfreeze backbone ──
        if epoch < warmup_epochs:
            lr = warmup_lr(epoch, warmup_epochs, config['learning_rate'])
            for pg in optimizer.param_groups:
                pg['lr'] = lr
        elif epoch == warmup_epochs:
            # Unfreeze backbone and rebuild optimizer with differential LR
            model.unfreeze_backbone()
            # Lower LR for backbone, higher for classifier
            backbone_params = []
            classifier_params = []
            for name, param in model.named_parameters():
                if 'classifier' in name or 'fc' in name:
                    classifier_params.append(param)
                else:
                    backbone_params.append(param)

            optimizer = optim.AdamW([
                {'params': backbone_params, 'lr': config['learning_rate'] * 0.1},
                {'params': classifier_params, 'lr': config['learning_rate']},
            ], weight_decay=config.get('weight_decay', 0.01))

            scheduler_cosine = CosineAnnealingLR(
                optimizer,
                T_max=num_epochs - warmup_epochs,
                eta_min=1e-6
            )
            scheduler_plateau = ReduceLROnPlateau(
                optimizer, mode='min', factor=0.5, patience=4, min_lr=1e-7
            )
            trainable, total = model.get_trainable_params()
            print(f"[INFO] After unfreeze: {trainable:,} trainable / {total:,} total")

        # ── Train ──
        model.train()
        train_loss = 0.0
        all_preds, all_labels = [], []
        optimizer.zero_grad()

        for batch_idx, batch in enumerate(train_loader):
            if use_mixup and len(batch) == 4:
                # Mixup mode: (mixed_images, label_a, label_b, lam)
                images, labels_a, labels_b, lam = batch
                images = images.to(device)
                labels_a = labels_a.to(device)
                labels_b = labels_b.to(device)

                outputs = model(images)

                # Use the first lam value (they're all the same in a batch)
                lam_val = lam[0].item() if isinstance(lam, torch.Tensor) else lam
                loss = mixup_criterion(outputs, labels_a, labels_b, lam_val)

                # For accuracy tracking, use the dominant label
                track_labels = labels_a if lam_val >= 0.5 else labels_b
            else:
                # Standard mode
                images, labels = batch[0], batch[1]
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                track_labels = labels

            # Gradient accumulation
            loss = loss / accumulation_steps
            loss.backward()

            if (batch_idx + 1) % accumulation_steps == 0 or (batch_idx + 1) == len(train_loader):
                # Gradient clipping for stability
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                optimizer.zero_grad()

            train_loss += loss.item() * accumulation_steps
            all_preds.append(outputs.argmax(1))
            all_labels.append(track_labels)

        train_preds = torch.cat(all_preds)
        train_labels = torch.cat(all_labels)
        train_acc, train_prec, train_rec, train_f1 = calculate_metrics(train_labels, train_preds)

        # ── Validate ──
        model.eval()
        val_loss = 0.0
        val_preds_list, val_labels_list = [], []

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                val_preds_list.append(outputs.argmax(1))
                val_labels_list.append(labels)

        val_preds = torch.cat(val_preds_list)
        val_labels = torch.cat(val_labels_list)
        val_acc, val_prec, val_rec, val_f1 = calculate_metrics(val_labels, val_preds)

        # ── Scheduler step ──
        if epoch >= warmup_epochs:
            scheduler_cosine.step()
            scheduler_plateau.step(val_loss / len(val_loader))

        current_lr = optimizer.param_groups[0]['lr']
        avg_train_loss = train_loss / len(train_loader)
        avg_val_loss = val_loss / len(val_loader)

        print(
            f"Epoch [{epoch+1:02d}/{num_epochs}] "
            f"Train Loss: {avg_train_loss:.4f} | Train Acc: {train_acc:.4f} | "
            f"Val Loss: {avg_val_loss:.4f} | Val Acc: {val_acc:.4f} | Val F1: {val_f1:.4f} | "
            f"LR: {current_lr:.6f}"
        )

        history.append({
            "epoch": epoch + 1,
            "train_loss": round(avg_train_loss, 4),
            "train_acc": round(float(train_acc), 4),
            "val_loss": round(avg_val_loss, 4),
            "val_acc": round(float(val_acc), 4),
            "val_f1": round(float(val_f1), 4),
            "lr": round(current_lr, 8),
        })

        # ── Save best model (by val accuracy, with val_loss as tiebreaker) ──
        improved = False
        if val_acc > best_val_acc:
            improved = True
        elif val_acc == best_val_acc and avg_val_loss < best_val_loss:
            improved = True

        if improved:
            best_val_acc = val_acc
            best_val_loss = avg_val_loss
            patience_counter = 0
            save_model(model)
            print(f"  [BEST] Saved best model (val_acc={val_acc:.4f}, val_f1={val_f1:.4f}, val_loss={avg_val_loss:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\n[STOP] Early stopping triggered after {epoch+1} epochs (no improvement for {patience} epochs)")
                break

    # ── Save training history ─────────────────────────────────────────────
    history_path = os.path.join(os.path.dirname(__file__), "..", "training_history.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\n[DONE] Training complete. Best Val Acc: {best_val_acc:.4f}")
    print(f"[INFO] Training history saved to training_history.json")

    # ── Per-class accuracy on validation set ──────────────────────────────
    print("\n[INFO] Per-class accuracy on validation set:")
    model.eval()
    class_correct = [0] * num_classes
    class_total = [0] * num_classes

    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            preds = outputs.argmax(1)
            for label, pred in zip(labels, preds):
                class_total[label.item()] += 1
                if label == pred:
                    class_correct[label.item()] += 1

    for i, cls in enumerate(classes):
        if class_total[i] > 0:
            acc = 100.0 * class_correct[i] / class_total[i]
            print(f"  {cls:30s}: {acc:.1f}%  ({class_correct[i]}/{class_total[i]})")

    overall = sum(class_correct) / max(sum(class_total), 1) * 100
    print(f"\n  {'OVERALL':30s}: {overall:.1f}%  ({sum(class_correct)}/{sum(class_total)})")

    if overall >= 92.0:
        print("\n[TARGET MET] TARGET ACCURACY OF 92% ACHIEVED!")
    else:
        print(f"\n[WARNING] Accuracy is {overall:.1f}%, below 92% target. Consider:")
        print("    - Running more epochs (increase num_epochs)")
        print("    - Collecting more data for underrepresented classes")
        print("    - Trying EfficientNet-B4 (set model_name: efficientnet_b4 in config.yaml)")

    # ── Cleanup GPU memory ────────────────────────────────────────────────
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


if __name__ == '__main__':
    torch.multiprocessing.set_start_method('spawn', force=True)
    main()
