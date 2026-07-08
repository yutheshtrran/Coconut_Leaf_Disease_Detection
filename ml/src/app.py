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

print("✅ Disease model: using disease_v5 (YOLO) for all predictions")
CLASSIFICATION_MODEL = None  # legacy EfficientNet slot — no longer used

# ------------------------------------------------------------------
# Farm Map pipeline routes (YOLO-based, independent of best_model.pth)
# ------------------------------------------------------------------
FARM_MAP_AVAILABLE = False
try:
    from map_pipeline import (
        farm_map_jobs,
        run_farm_map,
        analyze_tree_disease,
        analyze_drone_image,
    )
    FARM_MAP_AVAILABLE = True
    print("✅ Farm map pipeline loaded")
except Exception as _fme:
    print(f"[WARNING] Farm map pipeline unavailable: {_fme}")

try:
    from gps_extractor import extract_dji_gps
    GPS_AVAILABLE = True
except Exception as _ge:
    print(f"[WARNING] GPS extractor unavailable: {_ge}")
    GPS_AVAILABLE = False
    def extract_dji_gps(_path): return None


def _dms_to_dd(dms, ref):
    """Convert degrees/minutes/seconds tuple + hemisphere ref to decimal degrees."""
    d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
    dd = d + m / 60 + s / 3600
    return -dd if ref in ('S', 'W') else dd


def extract_exif_gps_image(image_path: str):
    """Extract GPS coordinates from JPEG EXIF data (e.g. DJI drone photos).
    Returns {lat, lon, altitude, source:'exif'} or None."""
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
        img = Image.open(image_path)
        exif = img._getexif()
        if not exif:
            return None
        gps_info = next(
            (v for tag_id, v in exif.items() if TAGS.get(tag_id) == 'GPSInfo'),
            None
        )
        if not gps_info:
            return None
        lat_dms = gps_info.get(2)   # GPSLatitude
        lat_ref = gps_info.get(1)   # GPSLatitudeRef  ('N'/'S')
        lon_dms = gps_info.get(4)   # GPSLongitude
        lon_ref = gps_info.get(3)   # GPSLongitudeRef ('E'/'W')
        if not (lat_dms and lon_dms and lat_ref and lon_ref):
            return None
        lat = _dms_to_dd(lat_dms, lat_ref)
        lon = _dms_to_dd(lon_dms, lon_ref)
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return None
        result = {'lat': round(lat, 7), 'lon': round(lon, 7), 'source': 'exif'}
        alt = gps_info.get(6)   # GPSAltitude
        if alt is not None:
            result['altitude'] = round(float(alt), 1)
        return result
    except Exception as _e:
        print(f'[GPS] EXIF extraction error: {_e}')
        return None

@app.route("/farm-map/start", methods=["POST"])
def farm_map_start():
    if not FARM_MAP_AVAILABLE:
        return jsonify({"success": False, "error": "Farm map pipeline not available"}), 500
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No video file uploaded"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400

    sid = str(uuid.uuid4())
    video_path = os.path.join(UPLOAD_DIR, f"{sid}_{f.filename}")
    f.save(video_path)

    settings = {k: request.form.get(k) for k in request.form if k != "file"}
    farm_map_jobs[sid] = {
        "stage": "stitch", "status": "queued", "progress": 0, "detail": "Queued…",
        "gps": None, "gps_status": "extracting",
    }

    import threading as _th

    def _run_gps(sid, path):
        try:
            result = extract_dji_gps(path)
            farm_map_jobs[sid]['gps']        = result
            farm_map_jobs[sid]['gps_status'] = 'done' if result else 'unavailable'
        except Exception as _e:
            print(f"[GPS] extraction error: {_e}")
            farm_map_jobs[sid]['gps_status'] = 'unavailable'

    _th.Thread(target=run_farm_map,  args=(sid, video_path, settings), daemon=True).start()
    _th.Thread(target=_run_gps,      args=(sid, video_path),           daemon=True).start()

    return jsonify({"success": True, "session_id": sid})

@app.route("/farm-map/progress/<session_id>", methods=["GET"])
def farm_map_progress(session_id):
    if not FARM_MAP_AVAILABLE:
        return jsonify({"success": False, "error": "Farm map pipeline not available"}), 500
    job = farm_map_jobs.get(session_id)
    if job is None:
        return jsonify({"success": False, "error": "Session not found"}), 404
    return jsonify({
        "success":    True,
        "stage":      job.get("stage", "stitch"),
        "status":     job.get("status", "queued"),
        "progress":   job.get("progress", 0),
        "detail":     job.get("detail", ""),
        "error":      job.get("error", ""),
        "traceback":  job.get("traceback", ""),
        "gps":        job.get("gps"),
        "gps_status": job.get("gps_status", "extracting"),
    })

@app.route("/farm-map/result/<session_id>", methods=["GET"])
def farm_map_result(session_id):
    if not FARM_MAP_AVAILABLE:
        return jsonify({"success": False, "error": "Farm map pipeline not available"}), 500
    job = farm_map_jobs.get(session_id)
    if job is None:
        return jsonify({"success": False, "error": "Session not found"}), 404
    if job.get("status") == "error":
        return jsonify({"success": False, "error": job.get("error", "Unknown error")}), 500
    if job.get("status") != "done" or "result" not in job:
        return jsonify({"success": False, "status": job.get("status"), "progress": job.get("progress", 0)}), 202

    result = job["result"]
    import json as _json
    trees_path = result.get("trees_path", "")
    trees = []
    if os.path.exists(trees_path):
        with open(trees_path) as _f:
            trees = _json.load(_f)

    return jsonify({
        "success":    True,
        "tree_count": result["tree_count"],
        "map_b64":    result["map_b64"],
        "trees":      trees,
        "gps":        job.get("gps"),
        "gps_status": job.get("gps_status", "unavailable"),
    })

@app.route("/extract-gps", methods=["POST"])
def extract_gps_endpoint():
    """Extract average GPS coordinates from a DJI drone video."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{f.filename}")
    try:
        f.save(tmp_path)
        gps = extract_dji_gps(tmp_path)
        if gps:
            return jsonify({"success": True, **gps})
        return jsonify({"success": False, "error": "No GPS data found in video"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            try: os.remove(tmp_path)
            except OSError: pass

@app.route("/farm-map/disease/<session_id>/<int:tree_id>", methods=["POST"])
def farm_map_disease(session_id, tree_id):
    if not FARM_MAP_AVAILABLE:
        return jsonify({"success": False, "error": "Farm map pipeline not available"}), 500
    try:
        result = analyze_tree_disease(session_id, tree_id)
        if result is None:
            return jsonify({"success": False, "error": "Tree not found"}), 404
        return jsonify({"success": True, **result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/farm-map/analyze-image", methods=["POST"])
def farm_map_analyze_image():
    """Detect trees in a single drone top-view image, then run disease on each crop."""
    if not FARM_MAP_AVAILABLE:
        return jsonify({"success": False, "error": "Farm map pipeline not available"}), 500
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No image uploaded"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400
    conf = float(request.form.get("conf", 0.35))
    img_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{f.filename}")
    f.save(img_path)
    try:
        # Extract GPS before analysis (file may be consumed by analysis pipeline)
        gps = extract_exif_gps_image(img_path)
        if gps:
            print(f"[GPS] Image EXIF: lat={gps['lat']:.6f} lon={gps['lon']:.6f}")
        result = analyze_drone_image(img_path, conf=conf)
        return jsonify({"success": True, "gps": gps, **result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(img_path):
            try:
                os.remove(img_path)
            except OSError:
                pass

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
                "annotated_image": output.get("annotated_image", ""),
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

            # ── Extract GPS for image ordering ────────────────────
            ordered_paths = image_paths
            try:
                from geo_utils import extract_and_process_image_gps
                geo_items, geo_metadata = extract_and_process_image_gps(image_paths, verbose=True)
                if geo_items:
                    ordered_paths = [item['path'] for item in geo_items]
                    print(f"[GEO] Ordered {len(ordered_paths)} images by GPS position")
            except Exception as geo_err:
                print(f"[GEO][WARN] GPS extraction skipped: {geo_err}")

            t0 = time.time()
            result = process_panoramic_images(
                image_paths=ordered_paths,
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

            response_data = {
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
            }

            return jsonify(response_data)

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
drone_progress = {}

@app.route("/drone-video-progress/<session_id>", methods=["GET"])
def get_drone_video_progress(session_id):
    """Endpoint for frontend to poll actual processing state."""
    status = drone_progress.get(session_id, "Processing...")
    return jsonify({"success": True, "status": status})

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
    # Extract one frame every 2 seconds at full native resolution
    FRAME_INTERVAL_SEC = 2    # seconds between extracted frames
    MAX_FRAMES         = 40   # hard cap to control memory usage

    # Support specific session ID provided by frontend for status tracking
    session_id = request.form.get("session_id", str(uuid.uuid4()))
    video_path = None
    frame_dir  = os.path.join(VIDEOFRAMES_DIR, session_id)
    drone_progress[session_id] = "Uploading video..."

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

        # ── Seek-based frame extraction at full resolution ────────
        drone_progress[session_id] = "Extracting frames..."
        t0 = time.time()
        frame_paths = []

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return jsonify({"error": "Could not open video file"}), 400

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        print(f"[INFO] Video: {total_frames} frames @ {fps:.1f} fps")

        # One frame every FRAME_INTERVAL_SEC seconds
        frame_step = max(1, int(round(fps * FRAME_INTERVAL_SEC)))
        print(f"[INFO] Frame step: {frame_step} (every {FRAME_INTERVAL_SEC}s at {fps:.1f} fps)")

        # Compute target frame indices upfront, then seek directly
        target_indices = list(range(0, total_frames, frame_step))[:MAX_FRAMES]

        for saved_idx, frame_idx in enumerate(target_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                continue

            # Save at full native resolution — no downscale
            # The grid panorama builder will handle uniform sizing
            frame_filename = os.path.join(frame_dir, f"frame_{saved_idx:04d}.jpg")
            cv2.imwrite(frame_filename, frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
            frame_paths.append(frame_filename)

            # Update progress string
            prog = int((saved_idx + 1) / len(target_indices) * 100)
            drone_progress[session_id] = f"Extracting frames... {prog}%"

        cap.release()
        t_extract = time.time() - t0
        print(f"[PERF] Frame extraction: {len(frame_paths)} frames "
              f"(full resolution, every {FRAME_INTERVAL_SEC}s) in {t_extract:.2f}s")

        # Delete the raw video immediately to free disk space
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
            video_path = None  # prevent double-delete in finally

        if not frame_paths:
            return jsonify({"error": "No frames could be extracted from the video"}), 400

        # ── Panorama + segmentation + classification ──────────────
        try:
            from segmentation_enhanced import process_panoramic_images

            clf_model = None
            clf_transform = clf_class_names = clf_device = None

            def prog_callback(msg):
                drone_progress[session_id] = msg

            # ── Geolocation extraction from video frame OSD ────────
            geo_data = None
            try:
                from geo_utils import extract_and_process_video_frame_gps
                geo_items, geo_metadata, has_osd = extract_and_process_video_frame_gps(
                    frame_paths, sample_rate=5, verbose=True
                )
                if geo_items:
                    geo_data = {
                        'geo_items': geo_items,
                        'geo_metadata': geo_metadata,
                        'crop_osd': has_osd,  # crop OSD strip if detected
                    }
            except Exception as geo_err:
                print(f"[GEO][WARN] Video GPS extraction skipped: {geo_err}")
                import traceback as _tb
                _tb.print_exc()

            t1 = time.time()
            result = process_panoramic_images(
                image_paths=frame_paths,
                output_dir=None,
                classification_model=clf_model,
                transform=clf_transform,
                class_names=clf_class_names,
                device=clf_device,
                verbose=True,
                progress_callback=prog_callback,
                geo_data=geo_data,
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
            },
            **({
                "geo_metadata": result['geo_metadata']
            } if result.get('geo_metadata') else {})
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

    disease_v5_path = os.path.join(ML_DIR, "weights", "disease_v5", "weights", "best.pt")
    if os.path.exists(disease_v5_path):
        print(f"✓ Disease model (disease_v5/best.pt) found")
    else:
        print(f"⚠ disease_v5/weights/best.pt not found — predictions will fail")

    if FARM_MAP_AVAILABLE:
        print("✓ Farm map pipeline ready (YOLO models)")
    else:
        print("⚠ Farm map pipeline unavailable")

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
    print("Make sure API is running on http://127.0.0.1:5001")
    time.sleep(3)
    try:
        r = requests.get("http://127.0.0.1:5001/")
        print(f"GET /           -> Status {r.status_code}, Response {r.json()}")
        r = requests.get("http://127.0.0.1:5001/health")
        print(f"GET /health     -> Status {r.status_code}, Response {r.json()}")
        print("✓ Basic tests passed")
    except Exception as e:
        print(f"✗ Tests failed: {e}")

def start_api():
    print_header("Starting Flask API Server")
    print("API Server running at http://127.0.0.1:5001")
    print("Press Ctrl+C to stop\n")
    app.run(host="0.0.0.0", port=5001, debug=True)

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
        run_check()
        start_api()

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
