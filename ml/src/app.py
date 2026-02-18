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
# Check model existence & Load Model
# ------------------------------------------------------------------
CLASSIFICATION_MODEL = None

if not os.path.exists(MODEL_PATH):
    print(f"[ERROR] Model NOT found at {MODEL_PATH}")
else:
    print("✅ Model file found")
    try:
        # Pre-load the model to avoid first-request latency
        # We need to import the build function or use the one from inference
        from inference import model as loaded_model
        CLASSIFICATION_MODEL = loaded_model
        print("✅ Classification model loaded into memory")
    except Exception as e:
        print(f"❌ Failed to load classification model: {e}")

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

        import re
        def _to_snake(name):
            return re.sub(r'[\s\-]+', '_', name.strip()).lower()

        confidence = float(output.get("confidence", 0.0))
        percentage = round(confidence * 100, 2)
        disease = output.get("disease", "Unknown")
        top3 = output.get("top3", [])

        # Try original name first, then snake_case fallback
        disease_info = (
            DISEASE_INFO.get(disease)
            or DISEASE_INFO.get(_to_snake(disease))
            or {}
        )

        return jsonify({
            "success": True,
            "prediction": {
                "disease": disease,
                "confidence": confidence,
                "percentage": percentage,
                "description": disease_info.get("description", ""),
                "impact": disease_info.get("impact", ""),
                "remedy": disease_info.get("remedy", "No remedy available"),
                "top3": top3,
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
    try:
        if "files" not in request.files:
            return jsonify({"error": "No files uploaded"}), 400

        files = request.files.getlist("files")
        if len(files) < 1:
            return jsonify({"error": "Need at least 1 image"}), 400

        # Save uploaded images temporarily
        image_paths = []
        for file in files:
            if file.filename == "":
                continue
            img_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
            file.save(img_path)
            image_paths.append(img_path)

        if not image_paths:
            return jsonify({"error": "No valid images uploaded"}), 400

        try:
            # Use the enhanced pipeline: stitch + watershed segmentation + numbered annotation + disease classification
            from segmentation_enhanced import process_panoramic_images
            
            # Import necessary components for classification
            from inference import device, _base_transform as transform, class_names

            result = process_panoramic_images(
                image_paths=image_paths,
                output_dir=None,  # Don't save to disk; we return base64
                classification_model=CLASSIFICATION_MODEL,
                transform=transform,
                class_names=class_names,
                device=device,
                verbose=True
            )

            panorama = result['panorama']
            annotated = result['annotated']
            tree_data = result['tree_data']
            disease_counts = result.get('disease_counts', {})

            # Save panorama for reference
            panorama_path = os.path.join(UPLOAD_DIR, f"panorama_{uuid.uuid4()}.jpg")
            cv2.imwrite(panorama_path, panorama)

            # Save annotated image
            annotated_path = os.path.join(UPLOAD_DIR, f"annotated_{uuid.uuid4()}.jpg")
            cv2.imwrite(annotated_path, annotated)

            # Convert annotated image to base64 for frontend
            import base64
            with open(annotated_path, "rb") as img_file:
                annotated_b64 = base64.b64encode(img_file.read()).decode('utf-8')
            
            # Calculate simple farm health score (0-100)
            total_trees = result['num_trees']
            healthy_trees = disease_counts.get('Healthy_Leaves', 0) + disease_counts.get('healthy_leaves', 0)
            health_score = (healthy_trees / total_trees * 100) if total_trees > 0 else 0

            # Build response
            response_data = {
                "success": True,
                "panorama_path": panorama_path,
                "annotated_image": f"data:image/jpeg;base64,{annotated_b64}",
                "tree_data": tree_data,
                "num_trees": result['num_trees'],
                "farm_health_score": round(health_score, 1),
                "disease_counts": disease_counts,
                "segmentation_stats": {
                    "total_trees_segmented": result['num_trees'],
                    "vegetation_coverage_px": int(np.sum(result['vegetation_mask'] > 0)),
                }
            }

            return jsonify(response_data)

        finally:
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
