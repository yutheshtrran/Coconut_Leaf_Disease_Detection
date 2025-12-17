# ml/src/train.py
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import models
from dataset import get_data_loaders
from utils import calculate_metrics, save_model
from yaml import safe_load

# Load config
with open("ml/src/config.yaml") as f:
    config = safe_load(f)

device = torch.device(config['device'] if torch.cuda.is_available() else 'cpu')

# Load data
train_loader, val_loader, classes = get_data_loaders()
num_classes = len(classes)

# Load pretrained model
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
model.fc = nn.Linear(model.fc.in_features, num_classes)
model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=config['learning_rate'])

best_val_acc = 0.0

for epoch in range(config['num_epochs']):
    model.train()
    train_loss = 0.0
    all_preds, all_labels = [], []

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        all_preds.append(outputs.argmax(1))
        all_labels.append(labels)

    train_preds = torch.cat(all_preds)
    train_labels = torch.cat(all_labels)
    train_acc, train_prec, train_rec, train_f1 = calculate_metrics(train_labels, train_preds)

    # Validation
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

    print(f"Epoch [{epoch+1}/{config['num_epochs']}], "
          f"Train Loss: {train_loss/len(train_loader):.4f}, "
          f"Val Loss: {val_loss/len(val_loader):.4f}, "
          f"Val Acc: {val_acc:.4f}")

    # Save best model
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        save_model(model)
        print("Saved Best Model ✅")
