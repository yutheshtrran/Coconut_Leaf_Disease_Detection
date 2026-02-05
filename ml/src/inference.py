# ML/src/inference.py
import torch
from torchvision import models, transforms
from PIL import Image
import os
from yaml import safe_load
import json

# Load config dynamically
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')

# Try to load class names from disease_info.json (keeps descriptions together with classes)
class_names = config.get('class_names', [])
disease_info_path = os.path.join(os.path.dirname(__file__), '..', 'logs', 'disease_info.json')
try:
    if os.path.exists(disease_info_path):
        with open(disease_info_path, 'r') as f:
            info = json.load(f)
            if isinstance(info, dict) and len(info) > 0:
                # Use the keys in the file as class names (preserve insertion order if present)
                class_names = list(info.keys())
except Exception:
    # fall back to config['class_names'] defined above
    pass

# Load model - infer num_classes from checkpoint
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
num_classes = len(class_names)
model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
weights_path = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")
try:
    checkpoint = torch.load(weights_path, map_location=device)
    # If checkpoint is a state_dict, try to load into model
    if isinstance(checkpoint, dict) and any(k.startswith('fc.') for k in checkpoint.keys()):
        # Determine num_classes from checkpoint fc weights
        if 'fc.weight' in checkpoint:
            num_classes = checkpoint['fc.weight'].shape[0]
        elif 'backbone.fc.weight' in checkpoint:
            num_classes = checkpoint['backbone.fc.weight'].shape[0]
        else:
            num_classes = len(class_names)

        # If class_names length doesn't match, try to load from splits folder
        if len(class_names) != num_classes:
            # Try to read train folder names
            splits_train = os.path.join(os.path.dirname(__file__), '..', 'data', 'splits', 'train')
            try:
                if os.path.exists(splits_train):
                    dirs = sorted([d for d in os.listdir(splits_train) if os.path.isdir(os.path.join(splits_train, d))])
                    if len(dirs) == num_classes:
                        class_names = dirs
                    else:
                        # pad or truncate to match checkpoint
                        if len(class_names) < num_classes:
                            class_names = class_names + [f'class_{i}' for i in range(len(class_names), num_classes)]
                        else:
                            class_names = class_names[:num_classes]
            except Exception:
                if len(class_names) < num_classes:
                    class_names = class_names + [f'class_{i}' for i in range(len(class_names), num_classes)]

        model.load_state_dict({k.replace('module.', ''): v for k, v in checkpoint.items() if isinstance(k, str)}, strict=False)
    else:
        # Checkpoint might be a full model object
        try:
            model = checkpoint
        except Exception:
            raise
except Exception as e:
    print(f"Warning: Could not load checkpoint properly: {e}")
    num_classes = len(class_names)
model.to(device)
model.eval()

transform = transforms.Compose([
    transforms.Resize((config['image_size'], config['image_size'])),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

def predict(image_path):
    image = Image.open(image_path).convert("RGB")
    image = transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(image)
        pred_idx = torch.argmax(outputs, 1).item()
        confidence = torch.softmax(outputs, dim=1)[0][pred_idx].item()
        return {"disease": class_names[pred_idx], "confidence": float(confidence)}


def load_config(path=None):
    """Load YAML config from given path or default config_path."""
    p = path or config_path
    with open(p) as f:
        return safe_load(f)


def load_class_names(cfg=None):
    """Return class names list from a config dict or from module config."""
    cfg = cfg or config
    cfg_names = cfg.get('class_names', []) or []
    # If config lists at least as many classes as we discovered, prefer config (explicit)
    if len(cfg_names) >= len(class_names):
        return cfg_names
    # Otherwise prefer the module-discovered class_names (disease_info or splits)
    if len(class_names) > 0:
        return class_names
    return cfg_names
