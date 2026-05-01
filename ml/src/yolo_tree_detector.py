import cv2
import numpy as np
from typing import List, Dict, Optional

try:
    from ultralytics import YOLO
except ImportError:
    print("Warning: ultralytics is not installed. Please run: pip install ultralytics")
    YOLO = None

# Global YOLO model instance to avoid reloading every frame
_yolo_model = None

import os
from pathlib import Path

# Fix path to load correctly from ml/weights/
DEFAULT_WEIGHTS = str(Path(__file__).parent.parent / "weights" / "best_yolo_seg.pt")

def detect_coconut_trees(
    image: np.ndarray,
    conf: float = 0.35,
    verbose: bool = True,
    model_path: str = DEFAULT_WEIGHTS
) -> List[Dict]:
    """
    Detect coconut tree crowns from aerial drone imagery using YOLO Segmentation.
    This acts as a high-accuracy, drop-in replacement for the old contour-based detector.

    Returns list of dicts:
      bbox, centroid, radius, confidence, area, polygon, circularity, solidity, radial_score
    """
    global _yolo_model
    if YOLO is None:
        raise RuntimeError("ultralytics library is required. Install with: pip install ultralytics")
        
    if _yolo_model is None:
        try:
            if verbose:
                print(f"[YOLO_TREE] Loading model from {model_path}...")
            _yolo_model = YOLO(model_path)
        except Exception as e:
            if verbose:
                print(f"[YOLO_TREE] Failed to load model ({e}). Ensure {model_path} exists and is valid.")
                print("[YOLO_TREE] Returning empty detection list.")
            return []
            
    if verbose:
        h, w = image.shape[:2]
        print(f"[YOLO_TREE] Inferring on {w}x{h} image with conf={conf}...")
        
    # Run YOLO segmentation. 
    # Using imgsz=1024 to match the tile size the model was trained on.
    results = _yolo_model(image, imgsz=1024, conf=conf, verbose=False)
    
    detections: List[Dict] = []
    
    for r in results:
        if r.masks is None or r.boxes is None:
            continue
            
        masks_xy = r.masks.xy
        boxes_cls = r.boxes.cls.cpu().numpy()
        boxes_conf = r.boxes.conf.cpu().numpy()
        boxes_xyxy = r.boxes.xyxy.cpu().numpy()
        
        for mask, cls, cnf, box in zip(masks_xy, boxes_cls, boxes_conf, boxes_xyxy):
            # 0 class maps to 'coconut_tree' per dataset.yaml
            if int(cls) == 0: 
                polygon = np.array(mask, dtype=np.int32)
                
                # Cannot process empty polygon
                if len(polygon) < 3:
                    continue
                
                # Calculate centroid using image moments
                M = cv2.moments(polygon)
                if M["m00"] > 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                else:
                    cx = int((box[0] + box[2]) / 2)
                    cy = int((box[1] + box[3]) / 2)
                    
                area = cv2.contourArea(polygon)
                radius = int(np.sqrt(area / np.pi)) if area > 0 else int((box[2] - box[0]) / 2)
                
                bx, by, bw, bh = cv2.boundingRect(polygon)
                
                detections.append({
                    "bbox": (bx, by, bw, bh),
                    "centroid": (cx, cy),
                    "radius": radius,
                    "confidence": float(cnf),
                    "area": int(area),
                    "polygon": polygon.tolist(), # Including the actual segmentation mask for downstream cropping
                    # Mock values for compatibility with old pipeline requirements
                    "circularity": 1.0, 
                    "solidity": 1.0,
                    "radial_score": 1.0
                })
                
    if verbose:
        print(f"[YOLO_TREE] Found {len(detections)} coconut crowns.")
        
    return detections
