# ML/src/inference.py
import os
import re
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
from yaml import safe_load
import json

# ── Config ────────────────────────────────────────────────────────────────────
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')

# ── Class names ───────────────────────────────────────────────────────────────
class_names = config.get('class_names', [])
disease_info_path = os.path.join(os.path.dirname(__file__), '..', 'logs', 'disease_info.json')
try:
    if os.path.exists(disease_info_path):
        with open(disease_info_path, 'r') as f:
            info = json.load(f)
            if isinstance(info, dict) and len(info) > 0:
                class_names = list(info.keys())
except Exception:
    pass

# ── Load model ────────────────────────────────────────────────────────────────
from torchvision import models as tv_models
import torch.nn as nn

def _build_model(num_classes, model_name='efficientnet_b3'):
    name = model_name.lower()
    if name == 'efficientnet_b3':
        m = tv_models.efficientnet_b3(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier = nn.Sequential(nn.Dropout(p=0.4, inplace=True), nn.Linear(in_f, num_classes))
    elif name == 'efficientnet_b0':
        m = tv_models.efficientnet_b0(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier = nn.Sequential(nn.Dropout(p=0.4, inplace=True), nn.Linear(in_f, num_classes))
    else:
        # ResNet50 fallback
        m = tv_models.resnet50(weights=None)
        in_f = m.fc.in_features
        m.fc = nn.Sequential(nn.Dropout(p=0.4), nn.Linear(in_f, num_classes))
    return m

weights_path = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")
model_name_cfg = config.get('model_name', 'efficientnet_b3')

try:
    checkpoint = torch.load(weights_path, map_location=device)

    if isinstance(checkpoint, dict):
        # Detect num_classes from checkpoint
        for key in ('classifier.1.weight', 'backbone.classifier.1.weight', 'fc.weight', 'backbone.fc.weight'):
            if key in checkpoint:
                num_classes = checkpoint[key].shape[0]
                break
        else:
            num_classes = len(class_names)

        # Sync class_names length
        if len(class_names) != num_classes:
            splits_train = os.path.join(os.path.dirname(__file__), '..', 'data', 'splits', 'train')
            if os.path.exists(splits_train):
                dirs = sorted([d for d in os.listdir(splits_train) if os.path.isdir(os.path.join(splits_train, d))])
                if len(dirs) == num_classes:
                    class_names = dirs

        model = _build_model(num_classes, model_name_cfg)
        # Strip 'module.' prefix if saved with DataParallel
        state = {k.replace('module.', ''): v for k, v in checkpoint.items()}
        model.load_state_dict(state, strict=False)
    else:
        model = checkpoint
        num_classes = len(class_names)

except FileNotFoundError:
    print(f"[WARNING] No weights found at {weights_path}. Model will give random predictions.")
    num_classes = len(class_names)
    model = _build_model(num_classes, model_name_cfg)
except Exception as e:
    print(f"[WARNING] Could not load checkpoint: {e}")
    num_classes = len(class_names)
    model = _build_model(num_classes, model_name_cfg)

model.to(device)
model.eval()

# ── Transforms ────────────────────────────────────────────────────────────────
image_size = config.get('image_size', 256)

# Standard inference transform (no augmentation)
_base_transform = transforms.Compose([
    transforms.Resize((image_size, image_size)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# TTA transforms — 5 slightly different views of the same image
_tta_transforms = [
    transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
    transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomHorizontalFlip(p=1.0),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
    transforms.Compose([
        transforms.Resize((int(image_size * 1.1), int(image_size * 1.1))),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
    transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomRotation(degrees=(10, 10)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
    transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomRotation(degrees=(-10, -10)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
]


def _to_snake(name: str) -> str:
    """Convert a class name like 'Gray Leaf Spot' → 'gray_leaf_spot' for disease_info lookup."""
    return re.sub(r'[\s\-]+', '_', name.strip()).lower()


def predict(image_path: str, use_tta: bool = True) -> dict:
    """
    Predict disease from an image file.

    Returns:
        {
            "disease": str,           # top-1 predicted class name
            "confidence": float,      # 0.0 – 1.0
            "top3": [                 # top-3 predictions
                {"disease": str, "confidence": float}, ...
            ]
        }
    """
    image = Image.open(image_path).convert("RGB")

    with torch.no_grad():
        if use_tta:
            # Average softmax probabilities over all TTA views
            probs_sum = None
            for tfm in _tta_transforms:
                tensor = tfm(image).unsqueeze(0).to(device)
                logits = model(tensor)
                probs = F.softmax(logits, dim=1)[0]
                probs_sum = probs if probs_sum is None else probs_sum + probs
            avg_probs = probs_sum / len(_tta_transforms)
        else:
            tensor = _base_transform(image).unsqueeze(0).to(device)
            logits = model(tensor)
            avg_probs = F.softmax(logits, dim=1)[0]

    # Top-3
    top3_vals, top3_idxs = torch.topk(avg_probs, k=min(3, len(class_names)))
    top3 = [
        {"disease": class_names[idx.item()], "confidence": round(val.item(), 4)}
        for val, idx in zip(top3_vals, top3_idxs)
    ]

    best = top3[0]
    return {
        "disease": best["disease"],
        "confidence": best["confidence"],
        "top3": top3,
    }


def load_config(path=None):
    """Load YAML config from given path or default config_path."""
    p = path or config_path
    with open(p) as f:
        return safe_load(f)


def load_class_names(cfg=None):
    """Return class names list from a config dict or from module config."""
    cfg = cfg or config
    cfg_names = cfg.get('class_names', []) or []
    if len(cfg_names) >= len(class_names):
        return cfg_names
    if len(class_names) > 0:
        return class_names
    return cfg_names
