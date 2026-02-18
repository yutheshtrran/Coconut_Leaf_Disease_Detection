#!/usr/bin/env python3
"""
Tree Segmentation and Labeling Module
Handles detection, segmentation, and labeling of coconut trees in video frames.

Enhanced with:
- Watershed algorithm + distance transform for individual tree crown splitting
- Multi-method vegetation detection (HSV + ExG + NDVI approximation)
- IoU-based duplicate removal
- Consistent left-to-right, top-to-bottom tree numbering
"""

import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image
import os
from yaml import safe_load
import json
from typing import List, Dict, Tuple, Optional

# Optional imports
try:
    from scipy import ndimage
except ImportError:
    ndimage = None

try:
    from sklearn.cluster import KMeans
except ImportError:
    KMeans = None


# ---------------------------------------------------------------------------
# Standalone preprocessing & segmentation functions (functional API)
# ---------------------------------------------------------------------------

def preprocess_for_trees(image: np.ndarray) -> np.ndarray:
    """
    Preprocess image to enhance individual tree crown visibility.
    Uses CLAHE + bilateral filter to sharpen tree boundaries.
    """
    denoised = cv2.bilateralFilter(image, 9, 75, 75)
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


def detect_vegetation_mask(image: np.ndarray) -> np.ndarray:
    """
    Detect vegetation using multiple color indices (HSV + ExG + NDVI approx).
    Requires at least 2 of 3 methods to agree — robust to lighting changes.
    Returns a binary mask of vegetation areas.
    """
    # Method 1: HSV green detection
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower_green = np.array([20, 30, 30])
    upper_green = np.array([100, 255, 255])
    hsv_mask = cv2.inRange(hsv, lower_green, upper_green)

    # Method 2: Excess Green Index (ExG = 2G - R - B)
    b_ch, g_ch, r_ch = cv2.split(image.astype(np.float32))
    exg = 2.0 * g_ch - r_ch - b_ch
    exg_norm = np.clip(exg, 0, None)
    exg_max = exg_norm.max()
    if exg_max > 0:
        exg_norm = (exg_norm / exg_max * 255).astype(np.uint8)
    else:
        exg_norm = exg_norm.astype(np.uint8)
    _, exg_mask = cv2.threshold(exg_norm, 60, 255, cv2.THRESH_BINARY)

    # Method 3: NDVI approximation using R and G channels
    ndvi_approx = (g_ch - r_ch) / (g_ch + r_ch + 1e-5)
    ndvi_norm = ((ndvi_approx + 1) / 2 * 255).astype(np.uint8)
    _, ndvi_mask = cv2.threshold(ndvi_norm, 140, 255, cv2.THRESH_BINARY)

    # Combine: require at least 2 of 3 methods to agree
    combined = (hsv_mask.astype(np.int32) + exg_mask.astype(np.int32) + ndvi_mask.astype(np.int32))
    vegetation_mask = (combined >= 2 * 255).astype(np.uint8) * 255

    # Morphological cleanup
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    kernel_medium = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    vegetation_mask = cv2.morphologyEx(vegetation_mask, cv2.MORPH_OPEN, kernel_small)
    vegetation_mask = cv2.morphologyEx(vegetation_mask, cv2.MORPH_CLOSE, kernel_medium)

    return vegetation_mask


def segment_individual_trees_watershed(
    image: np.ndarray,
    vegetation_mask: np.ndarray,
    min_tree_area: int = None,
    max_tree_area: int = None
) -> List[Dict]:
    """
    Use watershed algorithm + distance transform to segment individual tree crowns.
    This is the primary algorithm for splitting overlapping/touching tree crowns.
    """
    h, w = image.shape[:2]
    img_area = h * w

    if min_tree_area is None:
        min_tree_area = max(200, int(img_area * 0.0003))
    if max_tree_area is None:
        max_tree_area = int(img_area * 0.08)

    # Distance transform → local maxima = tree centers
    dist_transform = cv2.distanceTransform(vegetation_mask, cv2.DIST_L2, 5)
    cv2.normalize(dist_transform, dist_transform, 0, 1.0, cv2.NORM_MINMAX)

    _, sure_fg = cv2.threshold(dist_transform, 0.35, 1.0, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg * 255)

    kernel_bg = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    sure_bg = cv2.dilate(vegetation_mask, kernel_bg, iterations=2)
    unknown = cv2.subtract(sure_bg, sure_fg)

    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0

    markers_ws = cv2.watershed(image, markers)

    tree_regions = []
    for label in np.unique(markers_ws):
        if label <= 1:
            continue

        tree_mask = (markers_ws == label).astype(np.uint8) * 255
        contours, _ = cv2.findContours(tree_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(contour)

        if area < min_tree_area or area > max_tree_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        aspect_ratio = float(bw) / (bh + 1e-5)
        if aspect_ratio < 0.25 or aspect_ratio > 4.0:
            continue

        M = cv2.moments(contour)
        cx = int(M['m10'] / M['m00']) if M['m00'] > 0 else x + bw // 2
        cy = int(M['m01'] / M['m00']) if M['m00'] > 0 else y + bh // 2

        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = float(area) / (hull_area + 1e-5)
        if solidity < 0.3:
            continue

        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter ** 2 + 1e-5)

        tree_regions.append({
            'label': int(label),
            'bbox': (x, y, bw, bh),
            'centroid': (cx, cy),
            'area': float(area),
            'solidity': float(solidity),
            'circularity': float(circularity),
            'aspect_ratio': float(aspect_ratio),
            'contour': contour,
            'mask': tree_mask
        })

    return tree_regions


def segment_individual_trees_contour(
    image: np.ndarray,
    vegetation_mask: np.ndarray,
    min_tree_area: int = None,
    max_tree_area: int = None
) -> List[Dict]:
    """
    Fallback: contour-based segmentation with aggressive splitting for large blobs.
    Used when watershed doesn't find enough trees.
    """
    h, w = image.shape[:2]
    img_area = h * w

    if min_tree_area is None:
        min_tree_area = max(200, int(img_area * 0.0003))
    if max_tree_area is None:
        max_tree_area = int(img_area * 0.08)

    contours, _ = cv2.findContours(vegetation_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    tree_regions = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_tree_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        aspect_ratio = float(bw) / (bh + 1e-5)

        # Large blob → try to split using distance transform
        if area > max_tree_area * 0.5:
            sub_mask = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(sub_mask, [contour], -1, 255, -1)
            dist = cv2.distanceTransform(sub_mask, cv2.DIST_L2, 5)
            cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)
            _, sub_fg = cv2.threshold(dist, 0.4, 1.0, cv2.THRESH_BINARY)
            sub_fg = np.uint8(sub_fg * 255)
            num_labels, _, stats, centroids = cv2.connectedComponentsWithStats(sub_fg)

            if num_labels > 2:
                for i in range(1, num_labels):
                    sub_area = stats[i, cv2.CC_STAT_AREA]
                    if sub_area < 50:
                        continue
                    scx, scy = int(centroids[i][0]), int(centroids[i][1])
                    est_radius = max(int(np.sqrt(area / num_labels / np.pi)), 20)
                    rx1 = max(0, scx - est_radius)
                    ry1 = max(0, scy - est_radius)
                    rx2 = min(w, scx + est_radius)
                    ry2 = min(h, scy + est_radius)
                    rw, rh = rx2 - rx1, ry2 - ry1
                    if rw < 10 or rh < 10:
                        continue
                    tree_regions.append({
                        'label': len(tree_regions) + 100,
                        'bbox': (rx1, ry1, rw, rh),
                        'centroid': (scx, scy),
                        'area': float(rw * rh),
                        'solidity': 0.7,
                        'circularity': 0.5,
                        'aspect_ratio': float(rw) / (rh + 1e-5),
                        'contour': None,
                        'mask': None
                    })
                continue

        if area > max_tree_area or aspect_ratio < 0.25 or aspect_ratio > 4.0:
            continue

        M = cv2.moments(contour)
        cx = int(M['m10'] / M['m00']) if M['m00'] > 0 else x + bw // 2
        cy = int(M['m01'] / M['m00']) if M['m00'] > 0 else y + bh // 2

        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = float(area) / (hull_area + 1e-5)
        if solidity < 0.3:
            continue

        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter ** 2 + 1e-5)

        tree_regions.append({
            'label': len(tree_regions),
            'bbox': (x, y, bw, bh),
            'centroid': (cx, cy),
            'area': float(area),
            'solidity': float(solidity),
            'circularity': float(circularity),
            'aspect_ratio': float(aspect_ratio),
            'contour': contour,
            'mask': None
        })

    return tree_regions


def remove_duplicate_trees(tree_regions: List[Dict], overlap_threshold: float = 0.4) -> List[Dict]:
    """
    Remove duplicate detections using IoU-based deduplication.
    Keeps the detection with the best quality score (solidity + circularity + area).
    """
    if not tree_regions:
        return tree_regions

    def iou(box1, box2):
        x1, y1, w1, h1 = box1
        x2, y2, w2, h2 = box2
        ix1, iy1 = max(x1, x2), max(y1, y2)
        ix2, iy2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0
        inter = (ix2 - ix1) * (iy2 - iy1)
        union = w1 * h1 + w2 * h2 - inter
        return inter / (union + 1e-5)

    def quality_score(r):
        return r['solidity'] * 0.5 + r['circularity'] * 0.3 + min(r['area'] / 10000, 1.0) * 0.2

    sorted_regions = sorted(tree_regions, key=quality_score, reverse=True)
    unique = []
    for region in sorted_regions:
        if not any(iou(region['bbox'], kept['bbox']) > overlap_threshold for kept in unique):
            unique.append(region)
    return unique


def annotate_trees(
    image: np.ndarray,
    tree_regions: List[Dict],
    draw_mask: bool = True,
    draw_bbox: bool = True,
    draw_number: bool = True
) -> Tuple[np.ndarray, List[Dict]]:
    """
    Annotate image with individual tree detections.
    Each tree gets a unique number (1, 2, 3...) with a colored overlay.
    """
    annotated = image.copy()
    tree_data = []

    np.random.seed(42)
    colors = []
    for i in range(len(tree_regions)):
        hue = int((i * 137.508) % 180)  # Golden angle for distinct colors
        color_hsv = np.array([[[hue, 220, 220]]], dtype=np.uint8)
        color_bgr = cv2.cvtColor(color_hsv, cv2.COLOR_HSV2BGR)[0][0]
        colors.append((int(color_bgr[0]), int(color_bgr[1]), int(color_bgr[2])))

    for idx, region in enumerate(tree_regions):
        tree_num = idx + 1
        x, y, bw, bh = region['bbox']
        cx, cy = region['centroid']
        color = colors[idx] if idx < len(colors) else (0, 255, 0)

        # Semi-transparent mask overlay
        if draw_mask and region.get('mask') is not None:
            overlay = annotated.copy()
            mask_colored = np.zeros_like(image)
            mask_colored[region['mask'] == 255] = color
            annotated = cv2.addWeighted(overlay, 0.7, mask_colored, 0.3, 0)

        if draw_bbox:
            cv2.rectangle(annotated, (x, y), (x + bw, y + bh), color, 2)

        cv2.circle(annotated, (cx, cy), 4, color, -1)
        cv2.circle(annotated, (cx, cy), 4, (255, 255, 255), 1)

        if draw_number:
            label = str(tree_num)
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.55
            thickness = 2
            text_size = cv2.getTextSize(label, font, font_scale, thickness)[0]
            lx = max(0, cx - text_size[0] // 2)
            ly = max(text_size[1] + 4, y - 4)
            pad = 3
            cv2.rectangle(annotated,
                          (lx - pad, ly - text_size[1] - pad),
                          (lx + text_size[0] + pad, ly + pad),
                          color, -1)
            cv2.putText(annotated, label, (lx, ly), font, font_scale, (255, 255, 255), thickness)

        tree_data.append({
            'id': f'Tree_{tree_num}',
            'number': tree_num,
            'bbox': [x, y, x + bw, y + bh],
            'centroid': [cx, cy],
            'area': region['area'],
            'solidity': region['solidity'],
            'circularity': region['circularity'],
        })

    return annotated, tree_data


# ---------------------------------------------------------------------------
# TreeSegmenter class — backward-compatible, now uses the enhanced pipeline
# ---------------------------------------------------------------------------

class TreeSegmenter:
    """
    Segments and detects coconut trees in images.
    Now uses watershed + multi-method vegetation detection for higher accuracy.
    Backward-compatible with the original API.
    """

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "config.yaml")

        with open(config_path) as f:
            self.config = safe_load(f)

        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.image_size = self.config.get('image_size', 224)
        self.class_names = self._load_class_names()
        self.disease_model = self._load_disease_model()

        self.transform = transforms.Compose([
            transforms.Resize((self.image_size, self.image_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def _load_disease_model(self):
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
                            print(f"Warning: Checkpoint has {num_classes_in_checkpoint} classes, "
                                  f"config has {len(self.class_names)}. Adjusting.")
                            if len(self.class_names) > num_classes_in_checkpoint:
                                self.class_names = self.class_names[:num_classes_in_checkpoint]
                            else:
                                while len(self.class_names) < num_classes_in_checkpoint:
                                    self.class_names.append(f"Class_{len(self.class_names)}")
                    model.fc = torch.nn.Linear(model.fc.in_features, len(self.class_names))
                    model.load_state_dict(
                        {k.replace('module.', ''): v for k, v in checkpoint.items()}, strict=False)
                else:
                    model = checkpoint

            model.to(self.device)
            model.eval()
            return model
        except Exception as e:
            print(f"Warning: Could not load disease model: {e}")
            return None

    def _load_class_names(self):
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

    # ------------------------------------------------------------------
    # Public API — kept backward-compatible
    # ------------------------------------------------------------------

    def detect_green_areas(self, frame: np.ndarray) -> np.ndarray:
        """Detect vegetation mask. Now uses multi-method approach."""
        return detect_vegetation_mask(frame)

    def segment_trees(self, frame: np.ndarray):
        """
        Segment individual trees using watershed + contour fallback.
        Returns (tree_regions, centroids, green_mask) — same as original API.
        """
        preprocessed = preprocess_for_trees(frame)
        green_mask = detect_vegetation_mask(preprocessed)

        # Primary: watershed
        tree_regions = segment_individual_trees_watershed(preprocessed, green_mask)

        # Fallback: supplement with contour method if too few trees
        if len(tree_regions) < 5:
            contour_regions = segment_individual_trees_contour(preprocessed, green_mask)
            tree_regions = tree_regions + contour_regions

        # Deduplicate and sort
        tree_regions = remove_duplicate_trees(tree_regions, overlap_threshold=0.35)
        tree_regions = sorted(tree_regions,
                              key=lambda r: (r['centroid'][1] // 100, r['centroid'][0]))

        centroids = [r['centroid'] for r in tree_regions]
        return tree_regions, centroids, green_mask

    def classify_tree_health(self, frame: np.ndarray, tree_region: Dict):
        """Classify the health status of a tree region."""
        try:
            if self.disease_model is None:
                return 'Unknown', 0.0

            x, y, w, h = tree_region['bbox']
            pad = int(min(w, h) * 0.1)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(frame.shape[1], x + w + pad)
            y2 = min(frame.shape[0], y + h + pad)
            tree_img = frame[y1:y2, x1:x2]

            if tree_img.size == 0:
                return 'Unknown', 0.0

            pil_img = Image.fromarray(cv2.cvtColor(tree_img, cv2.COLOR_BGR2RGB))
            img_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

            with torch.no_grad():
                outputs = self.disease_model(img_tensor)
                pred_idx = torch.argmax(outputs, 1).item()
                confidence = torch.softmax(outputs, dim=1)[0][pred_idx].item()
                disease_name = (self.class_names[pred_idx]
                                if pred_idx < len(self.class_names) else 'Unknown')
                return disease_name, float(confidence)
        except Exception as e:
            print(f"Error classifying tree health: {e}")
            return 'Unknown', 0.0

    def calculate_health_percentage(self, disease_name: str, confidence: float) -> float:
        if disease_name.lower() == 'healthy':
            return min(100.0, confidence * 100)
        return max(0.0, (1.0 - confidence) * 100)

    def estimate_farm_size(self, frame: np.ndarray, tree_regions: List[Dict]) -> float:
        if not tree_regions:
            return 0.0
        green_area = sum(r['area'] for r in tree_regions)
        total_pixels = frame.shape[0] * frame.shape[1]
        coverage_percent = (green_area / total_pixels) * 100
        estimated_hectares = (coverage_percent / 30) * len(tree_regions) / 50
        return max(0.1, estimated_hectares)

    def label_trees_on_frame(self, frame: np.ndarray, tree_regions: List[Dict],
                              include_metrics: bool = False):
        """
        Draw labeled bounding boxes and numbers on the frame.
        Uses the new annotate_trees function for consistent coloring.
        Also runs disease classification per tree.
        """
        annotated_frame, _ = annotate_trees(frame, tree_regions,
                                             draw_mask=True, draw_bbox=True, draw_number=True)
        disease_counts = {}

        for idx, region in enumerate(tree_regions):
            disease, confidence = self.classify_tree_health(frame, region)
            disease_counts[disease] = disease_counts.get(disease, 0) + 1

            # Overlay disease text below the number label
            x, y, bw, bh = region['bbox']
            health_text = (f"Healthy ({confidence*100:.0f}%)"
                           if disease.lower() == 'healthy'
                           else f"{disease} ({confidence*100:.0f}%)")
            cv2.putText(annotated_frame, health_text, (x, y + bh + 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

        return annotated_frame, disease_counts

    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        Complete processing pipeline for a single frame.
        Returns the same dict structure as the original for backward compatibility.
        """
        tree_regions, centroids, green_mask = self.segment_trees(frame)
        labeled_frame, disease_counts = self.label_trees_on_frame(frame, tree_regions)

        num_trees = len(tree_regions)
        farm_size = self.estimate_farm_size(frame, tree_regions)
        healthy_count = disease_counts.get('Healthy', 0)
        diseased_count = num_trees - healthy_count
        health_percentage = (healthy_count / num_trees * 100) if num_trees > 0 else 0
        avg_tree_area = sum(r['area'] for r in tree_regions) / num_trees if num_trees > 0 else 0

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
        }


def create_segmenter(config_path: str = None) -> TreeSegmenter:
    """Factory function to create a segmenter instance."""
    return TreeSegmenter(config_path)
