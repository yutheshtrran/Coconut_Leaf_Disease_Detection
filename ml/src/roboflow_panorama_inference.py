import os
import cv2
import numpy as np
import argparse
from pathlib import Path
try:
    from inference_sdk import InferenceHTTPClient
except ImportError:
    print("Error: inference-sdk is not installed. Please run: pip install -U inference-sdk")
    sys.exit(1)

def calculate_iou(box1, box2):
    """Calculate IoU between two bounding boxes [x1, y1, x2, y2]"""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    if inter_area == 0:
        return 0
        
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    return inter_area / float(box1_area + box2_area - inter_area)

def process_panorama_roboflow(
    image_path, 
    api_key, 
    workspace_name="yutheshtrrans-workspace",
    workflow_id="find-coconut-trees",
    tile_size=1024, 
    overlap=0.2, 
    conf=0.35, 
    nms_iou_thresh=0.25
):
    """
    Run Roboflow API inference over a massive stitched panorama using sliding window tiles
    to prevent limits on image sizes over the network.
    """
    print(f"Loading panorama: {image_path}...")
    img = cv2.imread(str(image_path))
    if img is None:
        print("Failed to read image.")
        return
        
    h, w = img.shape[:2]
    stride = int(tile_size * (1 - overlap))
    
    try:
        from inference_sdk import InferenceHTTPClient
        client = InferenceHTTPClient(
            api_url="https://detect.roboflow.com",
            api_key=api_key
        )
    except ImportError:
        print("Error: inference-sdk is not installed. Please run: pip install -U inference-sdk")
        return
    
    print(f"Panorama size: {w}x{h}. Processing in {tile_size}x{tile_size} tiles via cloud API...")
    
    all_boxes = []     # List of [x1, y1, x2, y2, conf, cls]
    all_polygons = []  # List of coordinate arrays
    
    for y in range(0, h, stride):
        for x in range(0, w, stride):
            y_end = min(y + tile_size, h)
            x_end = min(x + tile_size, w)
            
            # If edge tile is too small
            tile_h = y_end - y
            tile_w = x_end - x
            if tile_h < 128 or tile_w < 128: 
                continue
                
            tile = img[y:y_end, x:x_end]
            
            # Run inference API via Roboflow SDK
            try:
                result = client.run_workflow(
                    workspace_name=workspace_name,
                    workflow_id=workflow_id,
                    images={"image": tile},
                    use_cache=True
                )
            except Exception as e:
                print(f"Failed tile at ({x}, {y}): {e}")
                continue
            
            # Generic dictionary parsing logic for Workflows
            raw_predictions = []
            if isinstance(result, list):
                raw_predictions = result
            elif isinstance(result, dict):
                for val in result.values():
                    if isinstance(val, dict) and "predictions" in val:
                        raw_predictions.extend(val["predictions"])
                    elif isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict) and "class" in val[0]:
                        raw_predictions.extend(val)
            
            for pred in raw_predictions:
                if pred.get("class") == "coconut_tree" and pred.get("confidence", 0) >= conf:
                    cx = pred.get("x", 0)
                    cy = pred.get("y", 0)
                    bw = pred.get("width", 0)
                    bh = pred.get("height", 0)
                    
                    cnf = float(pred.get("confidence", 0))
                    
                    global_bx = cx - bw/2 + x
                    global_by = cy - bh/2 + y
                    
                    global_box = [
                        global_bx, global_by,
                        global_bx + bw, global_by + bh,
                        cnf, 0
                    ]
                    
                    if "points" in pred:
                        global_mask = [[pt["x"] + x, pt["y"] + y] for pt in pred["points"]]
                    else:
                        global_mask = [
                            [global_bx, global_by], [global_bx + bw, global_by], 
                            [global_bx + bw, global_by + bh], [global_bx, global_by + bh]
                        ]
                        
                    all_boxes.append(global_box)
                    all_polygons.append(global_mask)
                        
    print(f"Initial detections across all API tiles: {len(all_boxes)}")
    
    if len(all_boxes) == 0:
        print("No trees detected.")
        return
        
    # Sort boxes by confidence
    indices = np.argsort([b[4] for b in all_boxes])[::-1]
    
    keep_indices = []
    
    for i in indices:
        box1 = all_boxes[i]
        keep = True
        for j in keep_indices:
            box2 = all_boxes[j]
            if calculate_iou(box1, box2) > nms_iou_thresh:
                keep = False
                break
        if keep:
            keep_indices.append(i)
            
    print(f"Final detections after NMS deduplication: {len(keep_indices)}")
    
    # Draw results for visualization
    output_img = img.copy()
    for idx in keep_indices:
        poly = all_polygons[idx]
        pts = np.array(poly, np.int32)
        pts = pts.reshape((-1, 1, 2))
        
        cv2.polylines(output_img, [pts], True, (0, 255, 0), 3)
        M = cv2.moments(pts)
        if M["m00"] > 0:
            mcx = int(M["m10"] / M["m00"])
            mcy = int(M["m01"] / M["m00"])
            cv2.circle(output_img, (mcx, mcy), 15, (0, 0, 255), -1)
            
    out_path = f"{Path(image_path).stem}_roboflow_pred.jpg"
    print(f"Saving visualization to {out_path}...")
    
    max_dim = 4000
    if h > max_dim or w > max_dim:
        scale = max_dim / max(h, w)
        output_img = cv2.resize(output_img, (int(w * scale), int(h * scale)))
        
    cv2.imwrite(out_path, output_img)
    print("Done!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to input panorama image")
    parser.add_argument("--key", default="", help="Roboflow API Key (defaults to ROBOFLOW_API_KEY env var)")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold")
    
    args = parser.parse_args()
    api_key = args.key or os.environ.get("ROBOFLOW_API_KEY")
    if not api_key:
        print("Error: Must provide --key or set ROBOFLOW_API_KEY environment variable.")
        exit(1)
        
    process_panorama_roboflow(args.image, api_key, conf=args.conf)
