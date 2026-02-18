# ML/src/dataset.py
import os
import torch
from torchvision import transforms
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader, WeightedRandomSampler
from yaml import safe_load

# Load config dynamically
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)


def get_data_loaders():
    image_size = config['image_size']
    batch_size = config['batch_size']

    # Strong augmentation for training — helps generalize on small datasets
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(30),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
        transforms.RandomGrayscale(p=0.05),
        transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.1, scale=(0.02, 0.1)),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225])
    ])

    # Dataset paths
    base_dir = os.path.join(os.path.dirname(__file__), "..", "data", "splits")
    train_dataset = ImageFolder(root=os.path.join(base_dir, "train"), transform=train_transform)
    val_dataset = ImageFolder(root=os.path.join(base_dir, "val"), transform=val_transform)

    # Weighted sampler to handle class imbalance
    class_counts = [0] * len(train_dataset.classes)
    for _, label in train_dataset.samples:
        class_counts[label] += 1

    class_weights = [1.0 / max(c, 1) for c in class_counts]
    sample_weights = [class_weights[label] for _, label in train_dataset.samples]
    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True
    )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, sampler=sampler, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)

    # Compute class weights tensor for loss function
    total = sum(class_counts)
    loss_class_weights = torch.tensor(
        [total / (len(class_counts) * max(c, 1)) for c in class_counts],
        dtype=torch.float
    )

    return train_loader, val_loader, train_dataset.classes, loss_class_weights
