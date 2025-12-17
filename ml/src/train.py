"""PyTorch training script for coconut leaf disease classification.

Creates datasets from directory structure, applies augmentations, trains a transfer-learning
model (from `model.py`) and saves best weights to `weights/`.
"""

import os
import json
import yaml
from pathlib import Path
from typing import List, Tuple

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import torchvision.transforms as T

from model import MyModel, load_weights


BASE_DIR = Path(__file__).resolve().parent


def load_config(path: str = None) -> dict:
    cfg_path = Path(path) if path else BASE_DIR / 'config.yaml'
    with open(cfg_path, 'r') as f:
        return yaml.safe_load(f)


class ImageFolderDataset(Dataset):
    def __init__(self, items: List[Tuple[str, int]], transform=None):
        self.items = items
        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, label = self.items[idx]
        img = Image.open(path).convert('RGB')
        if self.transform:
            img = self.transform(img)
        return img, label


def scan_classes(data_dir: Path) -> Tuple[List[str], List[Tuple[str, int]]]:
    classes = []
    items = []
    for entry in sorted(data_dir.iterdir()):
        if entry.is_dir():
            classes.append(entry.name)
    class_to_idx = {c: i for i, c in enumerate(classes)}
    for cls in classes:
        for img in (data_dir / cls).iterdir():
            if img.suffix.lower() in ('.jpg', '.jpeg', '.png'):
                items.append((str(img), class_to_idx[cls]))
    return classes, items


def make_transforms(image_size: Tuple[int, int]):
    train_tf = T.Compose([
        T.RandomResizedCrop(image_size),
        T.RandomHorizontalFlip(),
        T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    val_tf = T.Compose([
        T.Resize(image_size),
        T.CenterCrop(image_size),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    return train_tf, val_tf


def save_best_model(model: nn.Module, out_dir: Path, name: str = 'best_model.pth'):
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), str(out_dir / name))


def train():
    cfg = load_config()

    # data paths (relative to ml/src)
    data_cfg = cfg.get('data', {})
    train_dir = BASE_DIR.parent / 'uploads/trained_images'
    val_dir = BASE_DIR.parent / 'uploads/trained_images'  # use same if you don’t have separate val


    image_size = cfg.get('image_size')
    if isinstance(image_size, list):
        image_size = tuple(image_size)
    elif isinstance(image_size, int):
        image_size = (image_size, image_size)
    else:
        image_size = (224, 224)

    train_tf, val_tf = make_transforms(image_size)

    # scan classes and items
    classes, train_items = scan_classes(train_dir)
    _, val_items = scan_classes(val_dir)

    num_classes = len(classes)
    print(f'Found {num_classes} classes: {classes}')

    train_dataset = ImageFolderDataset(train_items, transform=train_tf)
    val_dataset = ImageFolderDataset(val_items, transform=val_tf)

    batch_size = cfg.get('batch_size', 32)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model_name = cfg.get('model_name', 'resnet50')
    model = MyModel(num_classes=num_classes, model_name=model_name, pretrained=True).to(device)

    lr = cfg.get('learning_rate', 1e-3)
    epochs = cfg.get('num_epochs', 20)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    weights_dir = BASE_DIR.parent / 'weights'
    weights_dir.mkdir(parents=True, exist_ok=True)

    best_acc = 0.0
    history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        running_corrects = 0
        total = 0

        for inputs, labels in train_loader:
            inputs = inputs.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()
            outputs = model(inputs)
            if isinstance(outputs, tuple) or isinstance(outputs, list):
                outputs = outputs[0]
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            preds = torch.argmax(outputs, dim=1)
            running_loss += loss.item() * inputs.size(0)
            running_corrects += torch.sum(preds == labels.data).item()
            total += inputs.size(0)

        epoch_loss = running_loss / max(total, 1)
        epoch_acc = running_corrects / max(total, 1)

        # validation
        model.eval()
        val_loss = 0.0
        val_corrects = 0
        val_total = 0
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs = inputs.to(device)
                labels = labels.to(device)
                outputs = model(inputs)
                if isinstance(outputs, (tuple, list)):
                    outputs = outputs[0]
                loss = criterion(outputs, labels)
                preds = torch.argmax(outputs, dim=1)
                val_loss += loss.item() * inputs.size(0)
                val_corrects += torch.sum(preds == labels.data).item()
                val_total += inputs.size(0)

        val_epoch_loss = val_loss / max(val_total, 1)
        val_epoch_acc = val_corrects / max(val_total, 1)

        print(f'Epoch {epoch}/{epochs} - train_loss: {epoch_loss:.4f} train_acc: {epoch_acc:.4f} - val_loss: {val_epoch_loss:.4f} val_acc: {val_epoch_acc:.4f}')

        history['train_loss'].append(epoch_loss)
        history['val_loss'].append(val_epoch_loss)
        history['train_acc'].append(epoch_acc)
        history['val_acc'].append(val_epoch_acc)

        # checkpoint
        if val_epoch_acc > best_acc:
            best_acc = val_epoch_acc
            save_path = weights_dir / 'best_model.pth'
            torch.save(model.state_dict(), str(save_path))
            print(f'Saved best model to {save_path} (val_acc={best_acc:.4f})')

    # final save of history
    with open(BASE_DIR.parent / 'training_history.json', 'w') as fh:
        json.dump(history, fh)


if __name__ == '__main__':
    train()