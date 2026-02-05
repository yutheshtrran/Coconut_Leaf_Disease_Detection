"""
Tree Segmentation and Labeling Module
Handles detection, segmentation, and labeling of coconut trees in video frames
"""

import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image
import os
from yaml import safe_load
import json

# Optional imports
try:
    from scipy import ndimage
except ImportError:
    ndimage = None

try:
    from sklearn.cluster import KMeans
except ImportError:
    KMeans = None


class TreeSegmenter:
    """Segments and detects coconut trees in images"""
    
    def __init__(self, config_path: str = None):
        """Initialize the segmenter with configuration"""
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
        
        with open(config_path) as f:
            self.config = safe_load(f)
        
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.image_size = self.config.get('image_size', 224)
        
        # Load class names
        self.class_names = self._load_class_names()
        
        # Load disease model for leaf classification
        self.disease_model = self._load_disease_model()
        
        # Transformation pipeline
        self.transform = transforms.Compose([
            transforms.Resize((self.image_size, self.image_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                               [0.229, 0.224, 0.225])
        ])
    
    def _load_disease_model(self):
        """Load the pretrained disease classification model"""
        from torchvision import models
        
        try:
            model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
            weights_path = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")
            
            if os.path.exists(weights_path):
                checkpoint = torch.load(weights_path, map_location=self.device)
                if isinstance(checkpoint, dict):
                    # Check if checkpoint has fc layer and adjust class_names accordingly
                    if 'fc.weight' in checkpoint:
                        num_classes_in_checkpoint = checkpoint['fc.weight'].shape[0]
                        if num_classes_in_checkpoint != len(self.class_names):
                            print(f"Warning: Checkpoint has {num_classes_in_checkpoint} classes, but config has {len(self.class_names)}. Using checkpoint's class count.")
                            # Adjust class_names to match checkpoint
                            if len(self.class_names) > num_classes_in_checkpoint:
                                self.class_names = self.class_names[:num_classes_in_checkpoint]
                            else:
                                # Pad with generic names if needed
                                while len(self.class_names) < num_classes_in_checkpoint:
                                    self.class_names.append(f"Class_{len(self.class_names)}")
                    
                    model.fc = torch.nn.Linear(model.fc.in_features, len(self.class_names))
                    model.load_state_dict({k.replace('module.', ''): v for k, v in checkpoint.items()}, strict=False)
                else:
                    model = checkpoint
            
            model.to(self.device)
            model.eval()
            return model
        except Exception as e:
            print(f"Warning: Could not load disease model: {e}")
            return None
    
    def _load_class_names(self):
        """Load disease class names"""
        disease_info_path = os.path.join(os.path.dirname(__file__), '..', 'logs', 'disease_info.json')
        class_names = self.config.get('class_names', [])
        
        try:
            if os.path.exists(disease_info_path):
                with open(disease_info_path, 'r') as f:
                    info = json.load(f)
                    if isinstance(info, dict) and len(info) > 0:
                        class_names = list(info.keys())
        except Exception:
            pass
        
        return class_names or ['Healthy', 'Leaf Blight', 'Leaf Yellowing', 'Powdery Mildew', 'Rust']
    
    def detect_green_areas(self, frame):
        """
        Detect green areas in the frame using HSV color space
        Returns binary mask of green vegetation
        """
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Define range for green color (vegetation)
        # Green hue is approximately 40-80 in OpenCV HSV
        lower_green = np.array([25, 40, 40])
        upper_green = np.array([90, 255, 255])
        
        # Create mask for green areas
        green_mask = cv2.inRange(hsv, lower_green, upper_green)
        
        # Apply morphological operations to clean up the mask
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        green_mask = cv2.morphologyEx(green_mask, cv2.MORPH_CLOSE, kernel)
        green_mask = cv2.morphologyEx(green_mask, cv2.MORPH_OPEN, kernel)
        
        return green_mask
    
    def segment_trees(self, frame):
        """
        Segment individual trees from the frame using contour detection
        Returns list of tree regions and centroids
        """
        green_mask = self.detect_green_areas(frame)
        
        # Find contours
        contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        tree_regions = []
        centroids = []
        
        for contour in contours:
            # Calculate area
            area = cv2.contourArea(contour)
            
            # Filter by area to remove noise (trees should have minimum area)
            if area < 500:  # Minimum area threshold
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Get centroid
            M = cv2.moments(contour)
            if M['m00'] != 0:
                cx = int(M['m10'] / M['m00'])
                cy = int(M['m01'] / M['m00'])
            else:
                cx, cy = x + w // 2, y + h // 2
            
            # Store region and centroid
            tree_regions.append({
                'bbox': (x, y, w, h),
                'contour': contour,
                'area': area,
                'centroid': (cx, cy)
            })
            centroids.append((cx, cy))
        
        return tree_regions, centroids, green_mask
    
    def classify_tree_health(self, frame, tree_region):
        """
        Classify the health status of a tree region using the disease model
        Returns disease class and confidence
        """
        try:
            if self.disease_model is None:
                return 'Unknown', 0.0
            
            x, y, w, h = tree_region['bbox']
            
            # Extract tree region
            tree_img = frame[max(0, y):min(frame.shape[0], y+h), 
                           max(0, x):min(frame.shape[1], x+w)]
            
            if tree_img.size == 0:
                return 'Unknown', 0.0
            
            # Convert to PIL Image
            pil_img = Image.fromarray(cv2.cvtColor(tree_img, cv2.COLOR_BGR2RGB))
            
            # Transform and predict
            img_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                outputs = self.disease_model(img_tensor)
                pred_idx = torch.argmax(outputs, 1).item()
                confidence = torch.softmax(outputs, dim=1)[0][pred_idx].item()
                
                disease_name = self.class_names[pred_idx] if pred_idx < len(self.class_names) else 'Unknown'
                
                return disease_name, float(confidence)
        except Exception as e:
            print(f"Error classifying tree health: {e}")
            return 'Unknown', 0.0
    
    def calculate_health_percentage(self, disease_name, confidence):
        """
        Convert disease classification to health percentage
        Healthy trees = 100%, Diseased = (1 - confidence) * 100
        """
        if disease_name.lower() == 'healthy':
            return 100.0
        else:
            # Disease detected: health = inverse of disease confidence
            return max(0, (1.0 - confidence) * 100)
    
    def estimate_farm_size(self, frame, tree_regions):
        """
        Estimate farm size based on detected trees and frame dimensions
        Assumes frame covers a known distance (default 1 hectare per frame for estimation)
        Returns estimated farm size in hectares
        """
        if len(tree_regions) == 0:
            return 0.0
        
        # Calculate coverage percentage
        green_area = sum(region['area'] for region in tree_regions)
        total_area = frame.shape[0] * frame.shape[1]
        coverage_percent = (green_area / total_area) * 100
        
        # Estimate: assume a typical drone frame at standard altitude covers ~1-5 hectares
        # Based on coverage percentage, estimate farm size
        # This is a simplified estimation - adjust based on your drone specs
        estimated_hectares = (coverage_percent / 30) * len(tree_regions) / 50  # Rough estimation
        
        return max(0.1, estimated_hectares)  # Minimum 0.1 hectares
    
    def label_trees_on_frame(self, frame, tree_regions):
        """
        Draw labeled bounding boxes and centroids on the frame
        Returns annotated frame with tree labels
        """
        annotated_frame = frame.copy()
        disease_counts = {}
        
        for idx, region in enumerate(tree_regions):
            x, y, w, h = region['bbox']
            cx, cy = region['centroid']
            
            # Classify tree health
            disease, confidence = self.classify_tree_health(frame, region)
            health_percent = self.calculate_health_percentage(disease, confidence)
            
            # Track disease counts
            disease_counts[disease] = disease_counts.get(disease, 0) + 1
            
            # Choose color based on health status
            if disease.lower() == 'healthy':
                color = (0, 255, 0)  # Green for healthy
                label_text = f"Tree {idx+1}: Healthy ({health_percent:.0f}%)"
            else:
                color = (0, 0, 255)  # Red for diseased
                label_text = f"Tree {idx+1}: {disease} ({confidence*100:.0f}%)"
            
            # Draw bounding box
            cv2.rectangle(annotated_frame, (x, y), (x+w, y+h), color, 2)
            
            # Draw centroid
            cv2.circle(annotated_frame, (cx, cy), 5, color, -1)
            
            # Add label
            cv2.putText(annotated_frame, label_text, (x, y-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        return annotated_frame, disease_counts
    
    def process_frame(self, frame):
        """
        Complete processing pipeline for a single frame
        Returns segmented trees, annotations, and statistics
        """
        # Segment trees
        tree_regions, centroids, green_mask = self.segment_trees(frame)
        
        # Label trees
        labeled_frame, disease_counts = self.label_trees_on_frame(frame, tree_regions)
        
        # Calculate statistics
        num_trees = len(tree_regions)
        farm_size = self.estimate_farm_size(frame, tree_regions)
        
        # Count healthy and diseased trees
        healthy_count = disease_counts.get('Healthy', 0)
        diseased_count = num_trees - healthy_count
        health_percentage = (healthy_count / num_trees * 100) if num_trees > 0 else 0
        
        return {
            'num_trees': num_trees,
            'tree_regions': tree_regions,
            'centroids': centroids,
            'disease_counts': disease_counts,
            'healthy_count': healthy_count,
            'diseased_count': diseased_count,
            'health_percentage': health_percentage,
            'farm_size': farm_size,
            'labeled_frame': labeled_frame,
            'green_mask': green_mask
        }


def create_segmenter(config_path: str = None) -> TreeSegmenter:
    """Factory function to create a segmenter instance"""
    return TreeSegmenter(config_path)
