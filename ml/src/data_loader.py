import os
import pandas as pd
from sklearn.model_selection import train_test_split
from torchvision import transforms
from PIL import Image

class DataLoader:
    def __init__(self, data_dir, img_size=(224, 224), test_size=0.2, random_state=42):
        self.data_dir = data_dir
        self.img_size = img_size
        self.test_size = test_size
        self.random_state = random_state
        self.transform = transforms.Compose([
            transforms.Resize(self.img_size),
            transforms.ToTensor(),
        ])

    def load_data(self):
        images = []
        labels = []
        
        for label in os.listdir(self.data_dir):
            label_dir = os.path.join(self.data_dir, label)
            if os.path.isdir(label_dir):
                for img_file in os.listdir(label_dir):
                    img_path = os.path.join(label_dir, img_file)
                    if img_file.endswith(('.png', '.jpg', '.jpeg')):
                        images.append(img_path)
                        labels.append(label)

        return images, labels

    def split_data(self, images, labels):
        return train_test_split(images, labels, test_size=self.test_size, random_state=self.random_state)

    def load_and_preprocess(self):
        images, labels = self.load_data()
        return self.split_data(images, labels)

    def get_transformed_image(self, img_path):
        image = Image.open(img_path).convert('RGB')
        return self.transform(image)