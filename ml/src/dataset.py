# ML/src/dataset.py
import os
import torch
import numpy as np
from torchvision import transforms
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader, WeightedRandomSampler, Dataset
from yaml import safe_load
from PIL import Image

# Load config dynamically
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(config_path) as f:
    config = safe_load(f)


class MixupDataset(Dataset):
    """Wrapper that applies Mixup augmentation on-the-fly during training."""

    def __init__(self, dataset, alpha=0.2):
        self.dataset = dataset
        self.alpha = alpha
        self.classes = dataset.classes
        self.samples = dataset.samples

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        img1, label1 = self.dataset[idx]

        if self.alpha > 0:
            lam = np.random.beta(self.alpha, self.alpha)
        else:
            lam = 1.0

        # Pick a random second image
        idx2 = np.random.randint(len(self.dataset))
        img2, label2 = self.dataset[idx2]

        # Mix images
        mixed_img = lam * img1 + (1 - lam) * img2

        return mixed_img, label1, label2, lam


def get_data_loaders(use_mixup=True):
    image_size = config['image_size']
    batch_size = config['batch_size']
    mixup_alpha = config.get('mixup_alpha', 0.2) if use_mixup else 0.0

    # Strong augmentation for training - helps generalize on small datasets
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.6, 1.0), ratio=(0.8, 1.2)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(30),
        transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1)),
        transforms.ColorJitter(brightness=0.35, contrast=0.35, saturation=0.35, hue=0.1),
        transforms.RandomGrayscale(p=0.05),
        transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0)),
        transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.15)),
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

    # Optionally wrap with Mixup
    if mixup_alpha > 0:
        train_data = MixupDataset(train_dataset, alpha=mixup_alpha)
    else:
        train_data = train_dataset

    train_loader = DataLoader(
        train_data,
        batch_size=batch_size,
        sampler=sampler,
        num_workers=0,
        pin_memory=True
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=True
    )

    # Compute class weights tensor for loss function
    total = sum(class_counts)
    loss_class_weights = torch.tensor(
        [total / (len(class_counts) * max(c, 1)) for c in class_counts],
        dtype=torch.float
    )

    # Print class distribution
    print(f"[INFO] Training class distribution:")
    for i, cls in enumerate(train_dataset.classes):
        print(f"   {cls:30s}: {class_counts[i]:5d} images (weight: {loss_class_weights[i]:.2f})")
    print(f"   {'Total':30s}: {total:5d} images")

    return train_loader, val_loader, train_dataset.classes, loss_class_weights
