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
import shutil
import base64
import re
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

VIDEOFRAMES_DIR = os.path.join(ML_DIR, "videoframes")
os.makedirs(VIDEOFRAMES_DIR, exist_ok=True)

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
# ------------------------------------------------------------------
# Helper: encode a cv2 image (numpy array) to base64 JPEG string
# ------------------------------------------------------------------
def _img_to_b64(img_arr, quality=85):
    """Encode a BGR numpy image to a base64 JPEG data-URI string."""
    ok, buf = cv2.imencode(".jpg", img_arr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")

def _to_snake(name):
    """Convert a disease name to snake_case for lookup."""
    return re.sub(r'[\s\-]+', '_', (name or '').strip()).lower()

def _enrich_tree_data(tree_data):
    """Add description / impact / remedy from DISEASE_INFO to each tree dict."""
    for tree in tree_data:
        dis = tree.get("disease") or ""
        dis_info = (
            DISEASE_INFO.get(dis)
            or DISEASE_INFO.get(_to_snake(dis))
            or {}
        )
        tree["description"] = dis_info.get("description", "")
        tree["impact"]      = dis_info.get("impact", "")
        tree["remedy"]      = dis_info.get("remedy", "No specific remedy available.")

def _calc_health_score(disease_counts, num_trees):
    """Calculate farm health score (0-100) from disease counts."""
    healthy = disease_counts.get("Healthy_Leaves", 0) + disease_counts.get("healthy_leaves", 0)
    return round((healthy / num_trees * 100) if num_trees > 0 else 0, 1)


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
            from segmentation_enhanced import process_panoramic_images
            from inference import device, _base_transform as transform, class_names

            t0 = time.time()
            result = process_panoramic_images(
                image_paths=image_paths,
                output_dir=None,
                classification_model=CLASSIFICATION_MODEL,
                transform=transform,
                class_names=class_names,
                device=device,
                verbose=True
            )
            elapsed = time.time() - t0
            print(f"[PERF] process_panoramic_images took {elapsed:.2f}s")

            panorama      = result['panorama']
            annotated     = result['annotated']
            tree_data     = result['tree_data']
            disease_counts = result.get('disease_counts', {})
            num_trees     = result['num_trees']

            # Enrich tree data with disease info
            _enrich_tree_data(tree_data)

            # In-memory base64 encoding — no temp file writes
            annotated_b64 = _img_to_b64(annotated)
            panorama_b64  = _img_to_b64(panorama)

            return jsonify({
                "success": True,
                "annotated_image": annotated_b64,
                "panorama_image":  panorama_b64,
                "tree_data": tree_data,
                "num_trees": num_trees,
                "farm_health_score": _calc_health_score(disease_counts, num_trees),
                "disease_counts": disease_counts,
                "processing_time_s": round(elapsed, 2),
                "segmentation_stats": {
                    "total_trees_segmented": num_trees,
                    "vegetation_coverage_px": int(np.sum(result['vegetation_mask'] > 0)),
                }
            })

        finally:
            for path in image_paths:
                if os.path.exists(path):
                    os.remove(path)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
# ------------------------------------------------------------------
# Drone Video Processing API
# ------------------------------------------------------------------
@app.route("/process-drone-video", methods=["POST"])
def process_drone_video():
    """
    Upload a drone video → extract frames → stitch panorama → segment trees → classify.

    Optimisations:
      1. Seek-based frame extraction (skip decoding unwanted frames)
      2. Frames downscaled to FRAME_MAX_DIM during extraction → smaller disk + memory
      3. process_panoramic_images() handles further downscale for segmentation
      4. Batched GPU classification inside process_panoramic_images()
      5. Full cleanup of video + frame dir in finally block

    Returns JSON with annotated_image, panorama_image, tree_data,
    disease_counts, farm_health_score — same shape as /process-drone-images.
    """
    FRAME_STEP    = 30    # save every Nth frame (≈1 fps at 30fps video)
    MAX_FRAMES    = 40    # hard cap on extracted frames
    FRAME_MAX_DIM = 1500  # downscale each frame so longest edge ≤ this

    session_id = str(uuid.uuid4())
    video_path = None
    frame_dir  = os.path.join(VIDEOFRAMES_DIR, session_id)

    try:
        # ── Validate upload ───────────────────────────────────────
        if "file" not in request.files:
            return jsonify({"error": "No video uploaded"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        # ── Save video temporarily ────────────────────────────────
        video_path = os.path.join(UPLOAD_DIR, f"{session_id}_{file.filename}")
        file.save(video_path)
        os.makedirs(frame_dir, exist_ok=True)

        # ── Seek-based frame extraction + downscale ───────────────
        t0 = time.time()
        frame_paths = []

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return jsonify({"error": "Could not open video file"}), 400

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        print(f"[INFO] Video: {total_frames} frames @ {fps:.1f} fps")

        # Compute target frame indices upfront, then seek directly
        target_indices = list(range(0, total_frames, FRAME_STEP))[:MAX_FRAMES]

        for saved_idx, frame_idx in enumerate(target_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                continue

            # Downscale frame if too large (saves memory + speeds stitching)
            fh, fw = frame.shape[:2]
            longest = max(fh, fw)
            if longest > FRAME_MAX_DIM:
                s = FRAME_MAX_DIM / longest
                frame = cv2.resize(frame,
                                   (int(fw * s), int(fh * s)),
                                   interpolation=cv2.INTER_AREA)

            frame_filename = os.path.join(frame_dir, f"frame_{saved_idx:04d}.jpg")
            cv2.imwrite(frame_filename, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            frame_paths.append(frame_filename)

        cap.release()
        t_extract = time.time() - t0
        print(f"[PERF] Frame extraction: {len(frame_paths)} frames "
              f"(downscaled to ≤{FRAME_MAX_DIM}px) in {t_extract:.2f}s")

        # Delete the raw video immediately to free disk space
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
            video_path = None  # prevent double-delete in finally

        if not frame_paths:
            return jsonify({"error": "No frames could be extracted from the video"}), 400

        # ── Panorama + segmentation + classification ──────────────
        try:
            from segmentation_enhanced import process_panoramic_images

            clf_model = CLASSIFICATION_MODEL
            try:
                from inference import (device as inf_device,
                                       _base_transform as inf_transform,
                                       class_names as inf_class_names)
                clf_transform   = inf_transform
                clf_class_names = inf_class_names
                clf_device      = inf_device
            except Exception:
                clf_transform = clf_class_names = clf_device = None

            t1 = time.time()
            result = process_panoramic_images(
                image_paths=frame_paths,
                output_dir=None,
                classification_model=clf_model,
                transform=clf_transform,
                class_names=clf_class_names,
                device=clf_device,
                verbose=True,
            )
            t_pipeline = time.time() - t1
            print(f"[PERF] Panoramic pipeline: {t_pipeline:.2f}s")

        except Exception as seg_err:
            traceback.print_exc()
            return jsonify({"success": False,
                            "error": f"Segmentation failed: {seg_err}"}), 500

        panorama       = result["panorama"]
        annotated      = result["annotated"]
        tree_data      = result["tree_data"]
        num_trees      = result["num_trees"]
        disease_counts = result.get("disease_counts", {})

        # ── Encode images as base64 (in-memory) ───────────────────
        annotated_b64 = _img_to_b64(annotated)
        panorama_b64  = _img_to_b64(panorama)

        # ── Enrich tree_data with disease info ────────────────────
        _enrich_tree_data(tree_data)

        # ── Build response ────────────────────────────────────────
        total_elapsed = time.time() - t0
        print(f"[PERF] Total drone-video pipeline: {total_elapsed:.2f}s")

        return jsonify({
            "success": True,
            "session_id": session_id,
            "frames_extracted": len(frame_paths),
            "num_trees": num_trees,
            "annotated_image": annotated_b64,
            "panorama_image":  panorama_b64,
            "tree_data": tree_data,
            "disease_counts": disease_counts,
            "farm_health_score": _calc_health_score(disease_counts, num_trees),
            "processing_time_s": round(total_elapsed, 2),
            "segmentation_stats": {
                "total_trees_segmented": num_trees,
                "vegetation_coverage_px": int(np.sum(result['vegetation_mask'] > 0)),
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        # ── Cleanup all temporary files ───────────────────────────
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except OSError:
                pass
        if os.path.isdir(frame_dir):
            try:
                shutil.rmtree(frame_dir, ignore_errors=True)
            except OSError:
                pass


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
