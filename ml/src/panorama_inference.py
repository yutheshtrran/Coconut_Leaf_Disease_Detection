import cv2
import numpy as np
import argparse
from pathlib import Path
try:
    from ultralytics import YOLO
except ImportError:
    print("Warning: ultralytics is not installed. Please run: pip install ultralytics")

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

def process_panorama(image_path, model_path, tile_size=1024, overlap=0.2, conf=0.35, nms_iou_thresh=0.25):
    """
    Run YOLO inference safely over a massive stitched panorama using a sliding window.
    Applies Non-Maximum Suppression to filter duplicate boxes from overlapping borders.
    """
    print(f"Loading panorama: {image_path}...")
    img = cv2.imread(str(image_path))
    if img is None:
        print("Failed to read image.")
        return
        
    h, w = img.shape[:2]
    stride = int(tile_size * (1 - overlap))
    
    print(f"Loading YOLO model from {model_path}...")
    model = YOLO(model_path)
    
    print(f"Panorama size: {w}x{h}. Processing in {tile_size}x{tile_size} tiles...")
    
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
            
            # Run inference
            results = model(tile, imgsz=tile_size, conf=conf, verbose=False)
            
            for r in results:
                if r.masks is None or r.boxes is None:
                    continue
                    
                masks_xy = r.masks.xy
                boxes_cls = r.boxes.cls.cpu().numpy()
                boxes_conf = r.boxes.conf.cpu().numpy()
                boxes_xyxy = r.boxes.xyxy.cpu().numpy()
                
                for mask, cls, cnf, box in zip(masks_xy, boxes_cls, boxes_conf, boxes_xyxy):
                    if int(cls) == 0:  # coconut_tree
                        # Shift coordinates back to global panorama coordinates
                        global_box = [
                            box[0] + x, box[1] + y,
                            box[2] + x, box[3] + y,
                            float(cnf), int(cls)
                        ]
                        
                        global_mask = mask + np.array([[x, y]])
                        
                        all_boxes.append(global_box)
                        all_polygons.append(global_mask)
                        
    print(f"Initial detections across all tiles: {len(all_boxes)}")
    
    # Simple NMS to remove duplicates across tile boundaries
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
            
    print(f"Final detections after NMS: {len(keep_indices)}")
    
    # Draw results for visualization
    output_img = img.copy()
    for idx in keep_indices:
        poly = all_polygons[idx]
        pts = np.array(poly, np.int32)
        pts = pts.reshape((-1, 1, 2))
        
        # Draw bounding polygon
        cv2.polylines(output_img, [pts], True, (0, 255, 0), 3)
        
        # Draw Centroid
        M = cv2.moments(pts)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            cv2.circle(output_img, (cx, cy), 15, (0, 0, 255), -1)
            
    out_path = f"{Path(image_path).stem}_yolo_pred.jpg"
    print(f"Saving visualization to {out_path}...")
    
    # Resize output for local viewing if massive
    max_dim = 4000
    if h > max_dim or w > max_dim:
        scale = max_dim / max(h, w)
        output_img = cv2.resize(output_img, (int(w * scale), int(h * scale)))
        
    cv2.imwrite(out_path, output_img)
    print("Done!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to input panorama image")
    parser.add_argument("--model", default="runs/segment/train/weights/best.pt", help="Path to trained YOLO weights")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold")
    
    args = parser.parse_args()
    process_panorama(args.image, args.model, conf=args.conf)
