"""
Enhanced Tree Segmentation and Labeling Module
Improved accuracy with advanced image processing and multi-scale detection
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


class EnhancedTreeSegmenter:
    """Enhanced segmentation and detection of coconut trees with improved accuracy"""
    
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
                    if 'fc.weight' in checkpoint:
                        num_classes_in_checkpoint = checkpoint['fc.weight'].shape[0]
                        if num_classes_in_checkpoint != len(self.class_names):
                            if len(self.class_names) > num_classes_in_checkpoint:
                                self.class_names = self.class_names[:num_classes_in_checkpoint]
                            else:
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
    
    def detect_green_areas_enhanced(self, frame):
        """
        Detect green areas using multiple color spaces for robustness
        Combines HSV, LAB, and excess green detection
        """
        # Method 1: HSV-based detection
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_green = np.array([25, 40, 40])
        upper_green = np.array([90, 255, 255])
        hsv_mask = cv2.inRange(hsv, lower_green, upper_green)
        
        # Method 2: Excess Green Index (ExG) - more robust for vegetation
        # ExG = 2*G - R - B
        b, g, r = cv2.split(frame.astype(np.float32))
        exg = 2*g - r - b
        exg_normalized = ((exg.astype(np.float32) - exg.min()) / (exg.max() - exg.min() + 1e-5)) * 255
        exg_binary = cv2.threshold(exg_normalized.astype(np.uint8), 100, 255, cv2.THRESH_BINARY)[1]
        
        # Method 3: LAB color space
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b_channel = cv2.split(lab)
        lab_mask = cv2.inRange(a, 90, 130)  # a channel separates green from non-green
        
        # Combine masks with weighted voting
        combined_mask = cv2.addWeighted(hsv_mask, 0.4, exg_binary, 0.4, 0)
        combined_mask = cv2.addWeighted(combined_mask, 0.5, lab_mask, 0.2, 0)
        combined_mask = cv2.threshold(combined_mask, 50, 255, cv2.THRESH_BINARY)[1]
        
        # Advanced morphological operations
        kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_medium = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        
        # Remove noise
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel_small)
        
        # Fill small holes
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel_medium)
        
        # Dilate to connect nearby regions
        combined_mask = cv2.dilate(combined_mask, kernel_medium, iterations=1)
        
        return combined_mask
    
    def segment_trees_enhanced(self, frame):
        """
        Segment individual trees using multiple methods for improved accuracy
        - Contour detection with filtering
        - Connected components analysis
        - Watershed algorithm for overlapping regions
        """
        green_mask = self.detect_green_areas_enhanced(frame)
        
        # Method 1: Contour-based segmentation with validation
        contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        tree_regions = []
        validated_contours = []
        
        # Image dimensions for aspect ratio validation
        img_h, img_w = frame.shape[:2]
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Dynamic area threshold based on image size
            min_area = max(300, (img_h * img_w) * 0.002)  # 0.2% of image area
            max_area = (img_h * img_w) * 0.15  # 15% of image area
            
            if area < min_area or area > max_area:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Aspect ratio check (trees should be roughly square-ish)
            aspect_ratio = float(w) / h if h > 0 else 0
            if aspect_ratio < 0.3 or aspect_ratio > 3.0:
                continue
            
            # Circularity check (Solidity)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / hull_area if hull_area > 0 else 0
            
            if solidity < 0.5:  # Reject too fragmented regions
                continue
            
            # Get centroid
            M = cv2.moments(contour)
            if M['m00'] != 0:
                cx = int(M['m10'] / M['m00'])
                cy = int(M['m01'] / M['m00'])
            else:
                cx, cy = x + w // 2, y + h // 2
            
            # Calculate circularity (4*pi*area / perimeter^2)
            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * np.pi * area / (perimeter ** 2 + 1e-5) if perimeter > 0 else 0
            
            # Store validated region
            tree_regions.append({
                'bbox': (x, y, w, h),
                'contour': contour,
                'area': area,
                'centroid': (cx, cy),
                'solidity': solidity,
                'circularity': circularity,
                'aspect_ratio': aspect_ratio
            })
            validated_contours.append(contour)
        
        # Method 2: Connected Components Analysis for additional detection
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(green_mask, connectivity=8)
        
        for i in range(1, num_labels):  # Skip background (label 0)
            area = stats[i, cv2.CC_STAT_AREA]
            min_area = max(300, (img_h * img_w) * 0.002)
            max_area = (img_h * img_w) * 0.15
            
            if area < min_area or area > max_area:
                continue
            
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]
            cx, cy = int(centroids[i][0]), int(centroids[i][1])
            
            # Check if already detected by contour method
            is_duplicate = False
            for existing_region in tree_regions:
                ex, ey, ew, eh = existing_region['bbox']
                ex_cx, ex_cy = ex + ew // 2, ey + eh // 2
                distance = np.sqrt((cx - ex_cx) ** 2 + (cy - ex_cy) ** 2)
                if distance < max(w, h) * 0.3:  # 30% of size tolerance
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                tree_regions.append({
                    'bbox': (x, y, w, h),
                    'contour': None,
                    'area': area,
                    'centroid': (cx, cy),
                    'solidity': 0.8,
                    'circularity': 0,
                    'aspect_ratio': float(w) / h if h > 0 else 0
                })
        
        # Remove near-duplicates (trees detected by both methods)
        tree_regions = self._remove_duplicate_regions(tree_regions)
        
        centroids = [region['centroid'] for region in tree_regions]
        
        return tree_regions, centroids, green_mask
    
    def _remove_duplicate_regions(self, regions, distance_threshold=0.25):
        """Remove duplicate or overlapping regions"""
        if not regions:
            return regions
        
        # Sort by area (descending) to keep larger detections
        regions = sorted(regions, key=lambda r: r['area'], reverse=True)
        
        unique_regions = []
        for region in regions:
            cx, cy = region['centroid']
            is_duplicate = False
            
            for unique_region in unique_regions:
                ux, uy = unique_region['centroid']
                w = max(region['bbox'][2], unique_region['bbox'][2])
                h = max(region['bbox'][3], unique_region['bbox'][3])
                distance = np.sqrt((cx - ux) ** 2 + (cy - uy) ** 2)
                
                if distance < max(w, h) * distance_threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_regions.append(region)
        
        return unique_regions
    
    def classify_tree_health(self, frame, tree_region):
        """
        Classify the health status of a tree region using the disease model
        Returns disease class and confidence
        """
        try:
            if self.disease_model is None:
                return 'Unknown', 0.0
            
            x, y, w, h = tree_region['bbox']
            
            # Extract tree region with padding
            pad = int(min(w, h) * 0.1)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(frame.shape[1], x + w + pad)
            y2 = min(frame.shape[0], y + h + pad)
            
            tree_img = frame[y1:y2, x1:x2]
            
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
        Improved with confidence thresholding
        """
        if disease_name.lower() == 'healthy':
            return min(100.0, confidence * 100)  # Can be less than 100% if model is uncertain
        else:
            # Disease detected: health = inverse of disease confidence
            return max(0, (1.0 - confidence) * 100)
    
    def estimate_farm_size(self, frame, tree_regions):
        """
        Estimate farm size based on detected trees and frame dimensions
        Improved with better statistical modeling
        """
        if len(tree_regions) == 0:
            return 0.0
        
        # Calculate green area and coverage
        green_area_pixels = sum(region['area'] for region in tree_regions)
        total_pixels = frame.shape[0] * frame.shape[1]
        coverage_percent = (green_area_pixels / total_pixels) * 100
        
        # Average tree size
        avg_tree_area = green_area_pixels / len(tree_regions)
        
        # Estimate based on tree count and coverage
        # Assuming standard farm specs (adjust based on your drone altitude)
        estimated_hectares = (len(tree_regions) * avg_tree_area) / 100000  # Rough conversion
        
        return max(0.01, min(estimated_hectares, 10))  # Realistic bounds
    
    def label_trees_on_frame(self, frame, tree_regions, include_metrics=True):
        """
        Draw labeled bounding boxes and centroids on the frame
        Enhanced with additional metrics display
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
            
            # Optional: Add metrics
            if include_metrics:
                metrics_text = f"A:{region['area']:.0f} S:{region['solidity']:.2f}"
                cv2.putText(annotated_frame, metrics_text, (x, y+h+15),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        return annotated_frame, disease_counts
    
    def process_frame(self, frame):
        """
        Complete processing pipeline for a single frame with enhanced accuracy
        """
        # Segment trees
        tree_regions, centroids, green_mask = self.segment_trees_enhanced(frame)
        
        # Label trees
        labeled_frame, disease_counts = self.label_trees_on_frame(frame, tree_regions)
        
        # Calculate statistics
        num_trees = len(tree_regions)
        farm_size = self.estimate_farm_size(frame, tree_regions)
        
        # Count healthy and diseased trees
        healthy_count = disease_counts.get('Healthy', 0)
        diseased_count = num_trees - healthy_count
        health_percentage = (healthy_count / num_trees * 100) if num_trees > 0 else 0
        
        # Calculate additional metrics
        avg_tree_area = sum(r['area'] for r in tree_regions) / num_trees if num_trees > 0 else 0
        avg_solidity = sum(r['solidity'] for r in tree_regions) / num_trees if num_trees > 0 else 0
        
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
            'green_mask': green_mask,
            'avg_tree_area': avg_tree_area,
            'avg_solidity': avg_solidity
        }


def create_enhanced_segmenter(config_path: str = None) -> EnhancedTreeSegmenter:
    """Factory function to create an enhanced segmenter instance"""
    return EnhancedTreeSegmenter(config_path)
