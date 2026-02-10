#!/usr/bin/env python
"""
Full Coconut Leaf Disease API with quickstart functionality
Combines Flask API, video & image ML prediction, diagnostic checks,
dependency installation, report generation, and endpoint testing.
"""

import os
import sys
import subprocess
import json
import traceback
import argparse
import uuid
import time
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np

# Try to import ultralytics for YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[WARNING] Ultralytics not available for drone processing")

# ------------------------------------------------------------------
# Fix Python path so ml/ and ml/reports/ are importable
# ------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))   # ml/src
ML_DIR = os.path.dirname(BASE_DIR)                      # ml
sys.path.append(ML_DIR)

# ------------------------------------------------------------------
# Import ML and report modules
# ------------------------------------------------------------------
ML_MODULES_OK = False
VIDEO_AVAILABLE = False

try:
    from reports.report_generator import generate_dummy_report
    from inference import predict, load_config, load_class_names
    ML_MODULES_OK = True
except Exception as e:
    print(f"[WARNING] Could not import ML modules: {e}")
    traceback.print_exc()

try:
    from src.video_service import VideoAnalyzer
    VIDEO_AVAILABLE = True
except Exception as e:
    print(f"[WARNING] Video analysis module not available: {e}")
    VIDEO_AVAILABLE = False

# ------------------------------------------------------------------
# Flask setup
# ------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------
MODEL_PATH = os.path.join(ML_DIR, "weights", "best_model.pth")
CONFIG_PATH = os.path.join(BASE_DIR, "config.yaml")
DISEASE_INFO_PATH = os.path.join(ML_DIR, "logs", "disease_info.json")
UPLOAD_DIR = os.path.join(ML_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ------------------------------------------------------------------
# Load config, class names, and disease info
# ------------------------------------------------------------------
cfg = load_config(CONFIG_PATH) if ML_MODULES_OK else None
CLASS_NAMES = load_class_names(cfg) if ML_MODULES_OK else []

DISEASE_INFO = {}
if os.path.exists(DISEASE_INFO_PATH):
    try:
        with open(DISEASE_INFO_PATH, "r") as f:
            DISEASE_INFO = json.load(f)
    except Exception as e:
        print(f"[WARNING] Could not load disease_info.json: {e}")

# ------------------------------------------------------------------
# Check model existence
# ------------------------------------------------------------------
if not os.path.exists(MODEL_PATH):
    print(f"[ERROR] Model NOT found at {MODEL_PATH}")
else:
    print("✅ Model file found")

# ------------------------------------------------------------------
# Prediction API - image
# ------------------------------------------------------------------
@app.route("/predict", methods=["POST"])
def predict_api():
    if not ML_MODULES_OK:
        return jsonify({"success": False, "error": "ML modules not available"}), 500
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        img_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        try:
            file.save(img_path)
            output = predict(img_path)
        finally:
            if os.path.exists(img_path):
                os.remove(img_path)

        confidence = float(output.get("confidence", 0.0))
        percentage = round(confidence * 100, 2)
        disease = output.get("disease", "Unknown")
        disease_info = DISEASE_INFO.get(disease.lower(), {})

        return jsonify({
            "success": True,
            "prediction": {
                "disease": disease,
                "confidence": confidence,
                "percentage": percentage,
                "description": disease_info.get("description", ""),
                "impact": disease_info.get("impact", ""),
                "remedy": disease_info.get("remedy", "No remedy available")
            },
            "all_diseases": CLASS_NAMES
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------------------------------------------
# Video analysis API
# ------------------------------------------------------------------
@app.route("/analyze-video", methods=["POST"])
def analyze_video():
    if not VIDEO_AVAILABLE:
        return jsonify({"success": False, "error": "Video analysis not available"}), 500
    try:
        if "file" not in request.files:
            return jsonify({"error": "No video uploaded"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        video_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        try:
            file.save(video_path)
            analyzer = VideoAnalyzer()
            # ✅ Use the correct method
            result = analyzer.analyze_video(video_path)
        finally:
            if os.path.exists(video_path):
                os.remove(video_path)

        return jsonify({"success": True, "result": result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------------------------------------------
# Drone Image Processing API
# ------------------------------------------------------------------
@app.route("/process-drone-images", methods=["POST"])
def process_drone_images():
    if not YOLO_AVAILABLE:
        return jsonify({"success": False, "error": "YOLO not available for drone processing"}), 500
    
    try:
        if "files" not in request.files:
            return jsonify({"error": "No files uploaded"}), 400
        
        files = request.files.getlist("files")
        if len(files) < 2:
            return jsonify({"error": "Need at least 2 images for stitching"}), 400
        
        # Save uploaded images temporarily
        image_paths = []
        for file in files:
            if file.filename == "":
                continue
            img_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
            file.save(img_path)
            image_paths.append(img_path)
        
        if len(image_paths) < 2:
            return jsonify({"error": "Not enough valid images"}), 400
        
        try:
            # Import required modules
            from drone_pipeline import stitch_images, detect_trees_yolo, annotate_image
            from segmentation import TreeSegmenter
            
            # Stitch images using drone_pipeline
            images = []
            for path in image_paths:
                img = cv2.imread(path)
                if img is not None:
                    images.append(img)
            
            if len(images) < 2:
                return jsonify({"error": "Failed to load images"}), 400
            
            panorama = stitch_images(image_paths)
            
            if panorama is None:
                return jsonify({"error": "Failed to create panorama"}), 400
            
            # Save panorama temporarily
            panorama_path = os.path.join(UPLOAD_DIR, f"panorama_{uuid.uuid4()}.jpg")
            cv2.imwrite(panorama_path, panorama)
            
            # Use TreeSegmenter for initial tree detection
            segmenter = TreeSegmenter()
            segmentation_result = segmenter.process_frame(panorama)
            
            # Use YOLO for additional object detection
            yolo_results = detect_trees_yolo(panorama, 'yolov8n-seg.pt')
            
            # Combine results: Use TreeSegmenter results as primary, enhance with YOLO if needed
            annotated = panorama.copy()
            tree_data = []
            
            # Process TreeSegmenter results
            for idx, region in enumerate(segmentation_result['tree_regions']):
                x, y, w, h = region['bbox']
                cx, cy = region['centroid']
                
                # Draw red circle
                radius = min(w, h) // 2
                cv2.circle(annotated, (cx, cy), radius, (0, 0, 255), 2)
                
                # Add tree ID
                tree_id = f"Tree_{idx+1}"
                cv2.putText(annotated, tree_id, (cx - radius, cy - radius - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                
                # Classify tree health if possible
                disease, confidence = segmenter.classify_tree_health(panorama, region)
                health_percent = segmenter.calculate_health_percentage(disease, confidence)
                
                tree_data.append({
                    'id': tree_id,
                    'bbox': [x, y, x+w, y+h],
                    'centroid': [cx, cy],
                    'area': region['area'],
                    'disease': disease,
                    'confidence': confidence,
                    'health_percentage': health_percent
                })
            
            # If no trees found with TreeSegmenter, try YOLO results
            if len(tree_data) == 0 and yolo_results and len(yolo_results) > 0:
                boxes = yolo_results[0].boxes
                for i, box in enumerate(boxes):
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                    
                    # Draw red circle
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    radius = min(x2 - x1, y2 - y1) // 2
                    cv2.circle(annotated, (cx, cy), radius, (0, 0, 255), 2)
                    
                    # Add tree ID
                    tree_id = f"Tree_{i+1}"
                    cv2.putText(annotated, tree_id, (cx - radius, cy - radius - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                    
                    tree_data.append({
                        'id': tree_id,
                        'bbox': [x1, y1, x2, y2],
                        'confidence': float(box.conf[0].cpu().numpy()),
                        'source': 'yolo'
                    })
            
            # Save annotated image
            annotated_path = os.path.join(UPLOAD_DIR, f"annotated_{uuid.uuid4()}.jpg")
            cv2.imwrite(annotated_path, annotated)
            
            # Convert annotated image to base64 for frontend
            import base64
            with open(annotated_path, "rb") as img_file:
                annotated_b64 = base64.b64encode(img_file.read()).decode('utf-8')
            
            # Prepare response data
            response_data = {
                "success": True,
                "panorama_path": panorama_path,
                "annotated_image": f"data:image/jpeg;base64,{annotated_b64}",
                "tree_data": tree_data,
                "num_trees": len(tree_data),
                "segmentation_stats": {
                    "total_trees_segmented": segmentation_result['num_trees'],
                    "healthy_trees": segmentation_result['healthy_count'],
                    "diseased_trees": segmentation_result['diseased_count'],
                    "health_percentage": segmentation_result['health_percentage'],
                    "estimated_farm_size": segmentation_result['farm_size']
                }
            }
            
            return jsonify(response_data)
        
        finally:
            # Clean up temporary files
            for path in image_paths:
                if os.path.exists(path):
                    os.remove(path)
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
@app.route("/report/view/<report_id>")
def view_report(report_id):
    try:
        pdf_path = generate_dummy_report(report_id)
        return send_file(pdf_path, mimetype="application/pdf")
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/report/download/<report_id>")
def download_report(report_id):
    try:
        pdf_path = generate_dummy_report(report_id)
        return send_file(pdf_path, as_attachment=True)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------------------------------------------
# Health and root endpoints
# ------------------------------------------------------------------
@app.route("/", methods=["GET"])
def root():
    endpoints = [
        "/predict",
        "/analyze-video",
        "/process-drone-images",
        "/report/view/<id>",
        "/report/download/<id>"
    ]
    return jsonify({"success": True, "message": "Coconut Leaf Disease API running", "endpoints": endpoints})

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "ML_modules": ML_MODULES_OK, "video_available": VIDEO_AVAILABLE, "yolo_available": YOLO_AVAILABLE})

# ------------------------------------------------------------------
# Quickstart / helper functions
# ------------------------------------------------------------------
def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def run_check():
    print_header("Running Diagnostic Check")
    success = True

    if ML_MODULES_OK:
        print("✓ ML modules loaded successfully")
    else:
        print("✗ ML modules missing or failed to import")
        success = False

    if VIDEO_AVAILABLE:
        print("✓ Video analysis module available")
    else:
        print("⚠ Video analysis module unavailable")

    if os.path.exists(MODEL_PATH):
        print(f"✓ Model found at {MODEL_PATH}")
    else:
        print(f"✗ Model NOT found at {MODEL_PATH}")
        success = False

    if DISEASE_INFO:
        print(f"✓ Disease info loaded ({len(DISEASE_INFO)} entries)")
    else:
        print("⚠ Disease info missing or empty")

    print(f"✓ Number of classes: {len(CLASS_NAMES)}")
    print(f"✓ Classes: {CLASS_NAMES}")

    return success

def install_deps():
    print_header("Installing Dependencies")
    try:
        req_file = os.path.join(ML_DIR, "ai_api", "requirements.txt")
        if not os.path.exists(req_file):
            print(f"✗ requirements.txt not found at {req_file}")
            return False

        pip_cmd = [sys.executable, "-m", "pip", "install", "-r", req_file]
        print("Running:", " ".join(pip_cmd))
        result = subprocess.run(pip_cmd, cwd=ML_DIR)
        if result.returncode == 0:
            print("✓ Dependencies installed successfully")
            return True
        else:
            print("✗ Failed to install dependencies")
            return False
    except Exception as e:
        print(f"✗ Installation failed: {e}")
        traceback.print_exc()
        return False

def test_endpoints():
    print_header("Testing Endpoints")
    import requests
    print("Make sure API is running on http://127.0.0.1:5000")
    time.sleep(3)
    try:
        r = requests.get("http://127.0.0.1:5000/")
        print(f"GET /           -> Status {r.status_code}, Response {r.json()}")
        r = requests.get("http://127.0.0.1:5000/health")
        print(f"GET /health     -> Status {r.status_code}, Response {r.json()}")
        print("✓ Basic tests passed")
    except Exception as e:
        print(f"✗ Tests failed: {e}")

def start_api():
    print_header("Starting Flask API Server")
    print("API Server running at http://127.0.0.1:5000")
    print("Press Ctrl+C to stop\n")
    app.run(host="0.0.0.0", port=5000, debug=True)

# ------------------------------------------------------------------
# Main CLI interface
# ------------------------------------------------------------------
def main():
    print_header("Coconut Leaf Disease API - Quickstart")

    parser = argparse.ArgumentParser(description="Coconut Leaf Disease API Quickstart")
    parser.add_argument('action', nargs='?', choices=['check', 'install', 'run', 'test'], help='Action to perform')
    args = parser.parse_args()

    if args.action == 'check':
        run_check()
    elif args.action == 'install':
        install_deps()
    elif args.action == 'test':
        test_endpoints()
    elif args.action == 'run' or args.action is None:
        # Default: interactive
        success = run_check()
        if success:
            response = input("\nAll checks passed. Start API server? (y/n): ").lower()
            if response == 'y':
                start_api()
        else:
            print("✗ Pre-flight check failed. Resolve issues before running API.")

# ------------------------------------------------------------------
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nShutdown requested. Exiting...")
        sys.exit(0)
    except Exception as e:
        print(f"Unexpected error: {e}")
        traceback.print_exc()
        sys.exit(1)
