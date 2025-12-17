# ML/src/inference.py
import torch
from torchvision import models, transforms
from PIL import Image
import os
from yaml import safe_load

# Load config dynamically
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')
class_names = config['class_names']

# Load model - infer num_classes from checkpoint
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
num_classes = len(class_names)
model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
weights_path = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")
try:
    checkpoint = torch.load(weights_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint, strict=False)
    # Infer actual num_classes from checkpoint
    if 'fc.weight' in checkpoint:
        num_classes = checkpoint['fc.weight'].shape[0]
        # Update class_names if needed - pad to match checkpoint
        if len(class_names) < num_classes:
            class_names = class_names + [f'class_{i}' for i in range(len(class_names), num_classes)]
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
    return cfg.get('class_names', class_names)
