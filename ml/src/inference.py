# ml/src/inference.py
import torch
from torchvision import models, transforms
from PIL import Image
from yaml import safe_load

# Load config
with open("ml/src/config.yaml") as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')
class_names = config['class_names']

# Load model
num_classes = len(class_names)
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
model.load_state_dict(torch.load("ml/weights/best_model.pth", map_location=device))
model.to(device)
model.eval()

# Transform for single image
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
        return {"class": class_names[pred_idx], "confidence": float(confidence)}
