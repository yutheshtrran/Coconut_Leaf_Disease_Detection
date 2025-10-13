import torch
from torchvision import transforms
from PIL import Image
import json

# Load the model
def load_model(model_path):
    model = torch.load(model_path)
    model.eval()
    return model

# Preprocess the image
def preprocess_image(image_path):
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    image = Image.open(image_path).convert("RGB")
    image = preprocess(image)
    return image.unsqueeze(0)  # Add batch dimension

# Make inference
def make_inference(model, image_tensor):
    with torch.no_grad():
        output = model(image_tensor)
    return output

# Load class labels
def load_labels(label_path):
    with open(label_path) as f:
        labels = json.load(f)
    return labels

# Main function for inference
def infer(image_path, model_path, label_path):
    model = load_model(model_path)
    image_tensor = preprocess_image(image_path)
    output = make_inference(model, image_tensor)
    labels = load_labels(label_path)
    
    # Assuming output is a tensor of probabilities
    _, predicted_idx = torch.max(output, 1)
    predicted_label = labels[predicted_idx.item()]
    
    return predicted_label

# Example usage
if __name__ == "__main__":
    image_path = "path/to/image.jpg"
    model_path = "path/to/model.pth"
    label_path = "path/to/labels.json"
    
    result = infer(image_path, model_path, label_path)
    print(f"Predicted label: {result}")