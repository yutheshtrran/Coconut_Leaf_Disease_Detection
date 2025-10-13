import torch
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
from metrics import calculate_metrics
from data_loader import CustomDataset

def evaluate_model(model, data_loader, device):
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for images, labels in data_loader:
            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)
            _, preds = torch.max(outputs, 1)

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    return all_preds, all_labels

def main():
    # Load the model
    model = torch.load('path/to/your/model.pth')  # Update with your model path
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)

    # Prepare the data loader
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
    ])
    
    dataset = CustomDataset('path/to/your/test/data', transform=transform)  # Update with your test data path
    data_loader = DataLoader(dataset, batch_size=32, shuffle=False)

    # Evaluate the model
    preds, labels = evaluate_model(model, data_loader, device)

    # Calculate and print metrics
    metrics = calculate_metrics(labels, preds)
    print(metrics)

if __name__ == "__main__":
    main()