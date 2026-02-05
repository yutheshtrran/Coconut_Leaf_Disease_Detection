# ml/src/utils.py

import os
import torch
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


# =========================
# Metrics
# =========================
def calculate_metrics(y_true, y_pred):
    """
    Calculate accuracy, precision, recall, and F1 score
    """
    y_true = y_true.cpu().numpy()
    y_pred = y_pred.cpu().numpy()

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_true, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)

    return acc, prec, rec, f1


# =========================
# Model Saving
# =========================
def save_model(model, filename="best_model.pth"):
    """
    Save model weights to ml/weights/
    """
    weights_dir = os.path.join(os.path.dirname(__file__), "..", "weights")
    os.makedirs(weights_dir, exist_ok=True)

    path = os.path.join(weights_dir, filename)
    torch.save(model.state_dict(), path)


# =========================
# Model Loading
# =========================
def load_model(model, filename="best_model.pth", device="cpu"):
    """
    Load model weights from ml/weights/
    """
    weights_dir = os.path.join(os.path.dirname(__file__), "..", "weights")
    path = os.path.join(weights_dir, filename)

    if not os.path.exists(path):
        raise FileNotFoundError(f"Model weights not found: {path}")

    model.load_state_dict(torch.load(path, map_location=device))
    model.to(device)
    model.eval()

    return model


# =========================
# Inference (🔥 FIX)
# =========================
def infer(model, input_tensor, device="cpu"):
    """
    Run inference on input tensor
    Args:
        model: trained PyTorch model
        input_tensor: Tensor of shape [B, C, H, W]
        device: 'cpu' or 'cuda'
    Returns:
        predicted class indices
    """
    model.eval()
    model.to(device)

    with torch.no_grad():
        input_tensor = input_tensor.to(device)
        outputs = model(input_tensor)
        predictions = torch.argmax(outputs, dim=1)

    return predictions
