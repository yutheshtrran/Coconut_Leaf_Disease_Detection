# ML/src/evaluate_model.py
"""
Comprehensive evaluation of the trained coconut leaf disease model on the held-out test set.

Usage:
    cd ml/
    python src/evaluate_model.py

Outputs:
    - Per-class accuracy, precision, recall, F1
    - Overall accuracy and weighted F1
    - Confusion matrix (printed and saved as image)
    - Pass/fail against 92% target
"""
import os
import sys
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from torchvision import transforms, models as tv_models
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader
from yaml import safe_load
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)

# Ensure src/ is on path
sys.path.insert(0, os.path.dirname(__file__))

# ── Config ────────────────────────────────────────────────────────────────────
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')
image_size = config.get('image_size', 300)
model_name = config.get('model_name', 'efficientnet_b3')

TARGET_ACCURACY = 0.92


# ── Build model ──────────────────────────────────────────────────────────────
def _build_model(num_classes, model_name='efficientnet_b3'):
    name = model_name.lower()
    if name == 'efficientnet_b3':
        m = tv_models.efficientnet_b3(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier = nn.Sequential(nn.Dropout(p=0.3, inplace=True), nn.Linear(in_f, num_classes))
    elif name == 'efficientnet_b0':
        m = tv_models.efficientnet_b0(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier = nn.Sequential(nn.Dropout(p=0.3, inplace=True), nn.Linear(in_f, num_classes))
    elif name == 'efficientnet_b4':
        m = tv_models.efficientnet_b4(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier = nn.Sequential(nn.Dropout(p=0.3, inplace=True), nn.Linear(in_f, num_classes))
    else:
        m = tv_models.resnet50(weights=None)
        in_f = m.fc.in_features
        m.fc = nn.Sequential(nn.Dropout(p=0.3), nn.Linear(in_f, num_classes))
    return m


def evaluate():
    print(f"{'='*70}")
    print(f"  Coconut Leaf Disease Model - Test Set Evaluation")
    print(f"  Device: {device}")
    print(f"{'='*70}\n")

    # ── Load test dataset ─────────────────────────────────────────────────
    test_dir = os.path.join(os.path.dirname(__file__), "..", "data", "splits", "test")
    if not os.path.exists(test_dir):
        print(f"[ERROR] Test directory not found: {test_dir}")
        print("   Run 'python src/split_dataset.py' first to create data splits.")
        return

    test_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    test_dataset = ImageFolder(root=test_dir, transform=test_transform)
    test_loader = DataLoader(test_dataset, batch_size=16, shuffle=False, num_workers=0)
    classes = test_dataset.classes
    num_classes = len(classes)

    print(f"[INFO] Test set: {len(test_dataset)} images across {num_classes} classes")
    for i, cls in enumerate(classes):
        count = sum(1 for _, l in test_dataset.samples if l == i)
        print(f"   {cls:30s}: {count:5d}")

    # ── Load model ────────────────────────────────────────────────────────
    weights_path = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")
    if not os.path.exists(weights_path):
        print(f"\n[ERROR] Model weights not found: {weights_path}")
        print("   Run 'python src/train.py' first to train the model.")
        return

    checkpoint = torch.load(weights_path, map_location=device)

    if isinstance(checkpoint, dict):
        # Detect num_classes from checkpoint
        for key in ('classifier.1.weight', 'backbone.classifier.1.weight', 'fc.weight', 'backbone.fc.weight'):
            if key in checkpoint:
                detected_nc = checkpoint[key].shape[0]
                if detected_nc != num_classes:
                    print(f"[WARNING] checkpoint has {detected_nc} classes but test set has {num_classes}")
                break

        model = _build_model(num_classes, model_name)
        state = {k.replace('module.', ''): v for k, v in checkpoint.items()}
        if any(k.startswith('backbone.') for k in state):
            state = {k.replace('backbone.', ''): v for k, v in state.items()}
        model.load_state_dict(state, strict=False)
    else:
        model = checkpoint

    model.to(device)
    model.eval()
    print(f"\n[OK] Model loaded from {weights_path}")

    # ── Run evaluation ────────────────────────────────────────────────────
    all_preds = []
    all_labels = []
    all_probs = []

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = F.softmax(outputs, dim=1)
            preds = outputs.argmax(dim=1)

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.numpy())
            all_probs.extend(probs.cpu().numpy())

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)
    all_probs = np.array(all_probs)

    # ── Metrics ───────────────────────────────────────────────────────────
    overall_acc = accuracy_score(all_labels, all_preds)
    overall_prec = precision_score(all_labels, all_preds, average='weighted', zero_division=0)
    overall_rec = recall_score(all_labels, all_preds, average='weighted', zero_division=0)
    overall_f1 = f1_score(all_labels, all_preds, average='weighted', zero_division=0)

    print(f"\n{'='*70}")
    print(f"  OVERALL RESULTS")
    print(f"{'='*70}")
    print(f"  Accuracy  : {overall_acc:.4f} ({overall_acc*100:.2f}%)")
    print(f"  Precision : {overall_prec:.4f}")
    print(f"  Recall    : {overall_rec:.4f}")
    print(f"  F1 Score  : {overall_f1:.4f}")

    # ── Per-class report ──────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  PER-CLASS CLASSIFICATION REPORT")
    print(f"{'='*70}")
    print(classification_report(all_labels, all_preds, target_names=classes, zero_division=0))

    # ── Confusion matrix ──────────────────────────────────────────────────
    cm = confusion_matrix(all_labels, all_preds)
    print(f"{'='*70}")
    print(f"  CONFUSION MATRIX")
    print(f"{'='*70}")

    # Print header
    header = "Predicted ->".rjust(20)
    for cls in classes:
        header += f" {cls[:8]:>8}"
    print(header)
    print("-" * len(header))

    for i, cls in enumerate(classes):
        row = f"{cls[:18]:>18} |"
        for j in range(num_classes):
            row += f" {cm[i][j]:>8}"
        print(row)

    # ── Per-class accuracy ────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  PER-CLASS ACCURACY")
    print(f"{'='*70}")
    for i, cls in enumerate(classes):
        cls_total = cm[i].sum()
        cls_correct = cm[i][i]
        cls_acc = cls_correct / max(cls_total, 1)
        status = "[OK]" if cls_acc >= TARGET_ACCURACY else "[!!]"
        print(f"  {status} {cls:30s}: {cls_acc*100:.1f}%  ({cls_correct}/{cls_total})")

    # ── Average confidence analysis ───────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  CONFIDENCE ANALYSIS")
    print(f"{'='*70}")
    correct_mask = all_preds == all_labels
    if correct_mask.any():
        correct_confs = all_probs[np.arange(len(all_preds)), all_preds][correct_mask]
        print(f"  Avg confidence (correct)  : {correct_confs.mean():.4f}")
    if (~correct_mask).any():
        wrong_confs = all_probs[np.arange(len(all_preds)), all_preds][~correct_mask]
        print(f"  Avg confidence (incorrect): {wrong_confs.mean():.4f}")

    # ── Save results ──────────────────────────────────────────────────────
    results = {
        "overall_accuracy": round(float(overall_acc), 4),
        "overall_precision": round(float(overall_prec), 4),
        "overall_recall": round(float(overall_rec), 4),
        "overall_f1": round(float(overall_f1), 4),
        "target_accuracy": TARGET_ACCURACY,
        "target_met": bool(overall_acc >= TARGET_ACCURACY),
        "per_class": {},
    }
    for i, cls in enumerate(classes):
        cls_total = int(cm[i].sum())
        cls_correct = int(cm[i][i])
        results["per_class"][cls] = {
            "accuracy": round(cls_correct / max(cls_total, 1), 4),
            "total": cls_total,
            "correct": cls_correct,
        }

    results_path = os.path.join(os.path.dirname(__file__), "..", "evaluation_results.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[INFO] Results saved to {results_path}")

    # ── Final verdict ─────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    if overall_acc >= TARGET_ACCURACY:
        print(f"  [TARGET MET] TARGET ACCURACY OF {TARGET_ACCURACY*100:.0f}% ACHIEVED!")
        print(f"     Model accuracy: {overall_acc*100:.2f}%")
    else:
        print(f"  [WARNING] ACCURACY {overall_acc*100:.2f}% IS BELOW {TARGET_ACCURACY*100:.0f}% TARGET")
        print(f"     Gap: {(TARGET_ACCURACY - overall_acc)*100:.2f}%")
        print(f"     Suggestions:")
        print(f"      - Train for more epochs")
        print(f"      - Collect more data for weak classes")
        print(f"      - Try EfficientNet-B4 (model_name: efficientnet_b4 in config.yaml)")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    evaluate()
