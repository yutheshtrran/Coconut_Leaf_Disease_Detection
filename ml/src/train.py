# ML/src/train.py
import os
import sys
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from yaml import safe_load

# Ensure src/ is on path
sys.path.insert(0, os.path.dirname(__file__))
from dataset import get_data_loaders
from model import MyModel
from utils import calculate_metrics, save_model

# ── Config ────────────────────────────────────────────────────────────────────
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')
print(f"🖥  Training on: {device}")

# ── Data ──────────────────────────────────────────────────────────────────────
train_loader, val_loader, classes, class_weights = get_data_loaders()
num_classes = len(classes)
print(f"📦 Classes ({num_classes}): {classes}")

# ── Model ─────────────────────────────────────────────────────────────────────
model = MyModel(
    num_classes=num_classes,
    model_name=config.get('model_name', 'efficientnet_b3'),
    pretrained=True,
    dropout=0.4
).to(device)

# ── Loss, Optimizer, Scheduler ────────────────────────────────────────────────
class_weights = class_weights.to(device)
criterion = nn.CrossEntropyLoss(
    weight=class_weights,
    label_smoothing=config.get('label_smoothing', 0.1)
)

optimizer = optim.AdamW(
    model.parameters(),
    lr=config['learning_rate'],
    weight_decay=config.get('weight_decay', 1e-4)
)

num_epochs = config['num_epochs']
scheduler = CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-6)

# ── Training Loop ─────────────────────────────────────────────────────────────
best_val_acc = 0.0
patience = config.get('early_stopping_patience', 8)
patience_counter = 0
history = []

for epoch in range(num_epochs):
    # ── Train ──
    model.train()
    train_loss = 0.0
    all_preds, all_labels = [], []

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        # Gradient clipping for stability
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        train_loss += loss.item()
        all_preds.append(outputs.argmax(1))
        all_labels.append(labels)

    train_preds = torch.cat(all_preds)
    train_labels = torch.cat(all_labels)
    train_acc, train_prec, train_rec, train_f1 = calculate_metrics(train_labels, train_preds)

    # ── Validate ──
    model.eval()
    val_loss = 0.0
    val_preds, val_labels = [], []

    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            val_loss += loss.item()
            val_preds.append(outputs.argmax(1))
            val_labels.append(labels)

    val_preds = torch.cat(val_preds)
    val_labels = torch.cat(val_labels)
    val_acc, val_prec, val_rec, val_f1 = calculate_metrics(val_labels, val_preds)

    scheduler.step()
    current_lr = scheduler.get_last_lr()[0]

    print(
        f"Epoch [{epoch+1:02d}/{num_epochs}] "
        f"Train Loss: {train_loss/len(train_loader):.4f} | Train Acc: {train_acc:.4f} | "
        f"Val Loss: {val_loss/len(val_loader):.4f} | Val Acc: {val_acc:.4f} | "
        f"LR: {current_lr:.6f}"
    )

    history.append({
        "epoch": epoch + 1,
        "train_loss": round(train_loss / len(train_loader), 4),
        "train_acc": round(float(train_acc), 4),
        "val_loss": round(val_loss / len(val_loader), 4),
        "val_acc": round(float(val_acc), 4),
        "lr": round(current_lr, 8),
    })

    # ── Save best model ──
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        patience_counter = 0
        save_model(model)
        print(f"  ✅ Saved best model (val_acc={val_acc:.4f})")
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print(f"\n⏹  Early stopping triggered after {epoch+1} epochs (no improvement for {patience} epochs)")
            break

# ── Save training history ──────────────────────────────────────────────────────
history_path = os.path.join(os.path.dirname(__file__), "..", "training_history.json")
with open(history_path, "w") as f:
    json.dump(history, f, indent=2)

print(f"\n🏁 Training complete. Best Val Acc: {best_val_acc:.4f}")
print(f"📊 Training history saved to training_history.json")

# ── Per-class accuracy on validation set ──────────────────────────────────────
print("\n📋 Per-class accuracy on validation set:")
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
