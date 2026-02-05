# ML/src/utils.py
import torch
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import os

def calculate_metrics(y_true, y_pred):
    y_true = y_true.cpu().numpy()
    y_pred = y_pred.cpu().numpy()

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    rec = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)

    return acc, prec, rec, f1

def save_model(model, filename="best_model.pth"):
    weights_dir = os.path.join(os.path.dirname(__file__), "..", "weights")
    os.makedirs(weights_dir, exist_ok=True)
    path = os.path.join(weights_dir, filename)
    torch.save(model.state_dict(), path)
