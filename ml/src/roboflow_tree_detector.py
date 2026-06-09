import os
import cv2
import numpy as np
from typing import List, Dict, Optional

try:
    from inference_sdk import InferenceHTTPClient
except ImportError:
    print("Warning: inference-sdk is not installed. Please run: pip install -U inference-sdk")
    InferenceHTTPClient = None

# Global Client Instance
_rf_client = None

def get_roboflow_client(api_key: str = None) -> "InferenceHTTPClient":
    global _rf_client
    if _rf_client is None:
        if InferenceHTTPClient is None:
            raise RuntimeError("inference-sdk is required. Install with: pip install -U inference-sdk")
            
        key = api_key or os.environ.get("ROBOFLOW_API_KEY", "")
        if not key:
            raise ValueError("ROBOFLOW_API_KEY environment variable is not set. Please provide it.")
            
        _rf_client = InferenceHTTPClient(
            api_url="https://detect.roboflow.com",
            api_key=key
        )
    return _rf_client

def detect_coconut_trees(
    image: np.ndarray,
    api_key: str = None,
    workspace_name: str = "yutheshtrrans-workspace",
    workflow_id: str = "find-coconut-trees",
    conf: float = 0.35,
    verbose: bool = True,
) -> List[Dict]:
    """
    Detect coconut tree crowns from aerial drone imagery using Roboflow Hosted API.
    Use this as a drop-in replacing yolo_tree_detector.py to run in the cloud instead of locally.
    
    Warning: Network latency will affect inference speed!
    """
    if verbose:
        h, w = image.shape[:2]
        print(f"[ROBOFLOW_TREE] Requesting API inference on {w}x{h} image...")
        
    client = get_roboflow_client(api_key)
    
    # inference_sdk allows passing a numpy array directly under the "images" dictionary
    try:
        result = client.run_workflow(
            workspace_name=workspace_name,
            workflow_id=workflow_id,
            images={"image": image},
            use_cache=True
        )
    except Exception as e:
        if verbose:
            print(f"[ROBOFLOW_TREE] API Request Failed: {e}")
        return []
        
    # The result object format depends on the workflow structure.
    # Usually, predictions are nested in lists. We search for standard bounding box objects.
    
    raw_predictions = []
    
    # Check if the result is a list of predictions directly
    if isinstance(result, list):
        raw_predictions = result
    elif isinstance(result, dict):
        # Flatten any list of predictions found in the dictionary branches
        # e.g., result["model_predictions"] = [...]
        for val in result.values():
            if isinstance(val, dict) and "predictions" in val:
                raw_predictions.extend(val["predictions"])
            elif isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict) and "class" in val[0]:
                raw_predictions.extend(val)
                
    detections: List[Dict] = []
    
    for pred in raw_predictions:
        cls_name = pred.get("class", "")
        confidence = pred.get("confidence", 0.0)
        
        if cls_name != "coconut_tree":
            continue
            
        if confidence < conf:
            continue
            
        cx = pred.get("x", 0)
        cy = pred.get("y", 0)
        bw = pred.get("width", 0)
        bh = pred.get("height", 0)
        
        # Bbox top-left coordinates
        bx = cx - bw / 2
        by = cy - bh / 2
        
        polygon = []
        if "points" in pred:
            # Instance Segmentation polygon points `[{x,y}, {x,y}]`
            pts = pred["points"]
            polygon = np.array([[pt["x"], pt["y"]] for pt in pts], dtype=np.int32)
            area = cv2.contourArea(polygon)
            radius = int(np.sqrt(area / np.pi)) if area > 0 else int(max(bw, bh) / 2)
            
            # Recalculate robust centroid using accurate mask moments if possible
            M = cv2.moments(polygon)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
        else:
            # Bounding box fallback
            radius = int(max(bw, bh) / 2)
            area = bw * bh
            
            # Create a box polygon placeholder for compatibility
            polygon = np.array([
                [bx, by], [bx + bw, by], 
                [bx + bw, by + bh], [bx, by + bh]
            ], dtype=np.int32)
            
        detections.append({
            "bbox": (int(bx), int(by), int(bw), int(bh)),
            "centroid": (int(cx), int(cy)),
            "radius": int(radius),
            "confidence": float(confidence),
            "area": int(area),
            "polygon": polygon.tolist(),
            "circularity": 1.0, 
            "solidity": 1.0,
            "radial_score": 1.0
        })
        
    if verbose:
        print(f"[ROBOFLOW_TREE] Cloud API found {len(detections)} coconut crowns.")
        
    return detections
