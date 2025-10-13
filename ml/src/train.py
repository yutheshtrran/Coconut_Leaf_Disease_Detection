import os
import torch
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
from data_loader import CustomDataset  # Assuming you have a data_loader.py for loading your dataset
from model import MyModel  # Assuming you have a model.py defining your model architecture
from utils import save_model  # Assuming you have a utility function to save the model
import yaml

# Load configuration
with open('config.yaml', 'r') as file:
    config = yaml.safe_load(file)

# Set device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Data transformations
transform = transforms.Compose([
    transforms.Resize((config['image_size'], config['image_size'])),
    transforms.ToTensor(),
])

# Load datasets
train_dataset = CustomDataset(root=config['data_dir'] + '/train', transform=transform)
val_dataset = CustomDataset(root=config['data_dir'] + '/val', transform=transform)

train_loader = DataLoader(train_dataset, batch_size=config['batch_size'], shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=config['batch_size'], shuffle=False)

# Initialize model
model = MyModel(num_classes=config['num_classes']).to(device)

# Define loss and optimizer
criterion = torch.nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=config['learning_rate'])

# Training loop
for epoch in range(config['num_epochs']):
    model.train()
    running_loss = 0.0

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)

        # Forward pass
        outputs = model(images)
        loss = criterion(outputs, labels)

        # Backward pass and optimization
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        running_loss += loss.item()

    print(f'Epoch [{epoch+1}/{config["num_epochs"]}], Loss: {running_loss/len(train_loader):.4f}')

# Save the trained model
save_model(model, config['model_save_path'])