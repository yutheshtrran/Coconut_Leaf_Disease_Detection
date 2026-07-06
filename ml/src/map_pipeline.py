"""
Farm Map Pipeline — adapted for Flask/threading (CLDD).
video → stitch orthomosaic → tile-detect trees → save crops → disease on demand
"""

import base64
import csv
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

# ── Paths ──────────────────────────────────────────────────────────────────────
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))  # ml/src
_ML_DIR  = os.path.dirname(_SRC_DIR)                   # ml

TREE_WEIGHTS    = os.path.join(_ML_DIR, 'weights', 'coconut_tree_v6-3.pt')
DISEASE_WEIGHTS = os.path.join(_ML_DIR, 'weights', 'coconut_disease_v5.pt')
JOBS_DIR        = os.path.join(_ML_DIR, 'farm_map_jobs')
os.makedirs(JOBS_DIR, exist_ok=True)

# ── Detection constants ────────────────────────────────────────────────────────
TILE_SIZE = 1280
OVERLAP   = 256
CROP_PAD  = 24

# ── Thread pool — 2 workers to avoid GPU OOM ──────────────────────────────────
EXECUTOR = ThreadPoolExecutor(max_workers=2)

# ── Model caches ──────────────────────────────────────────────────────────────
_tree_model    = None
_disease_model = None
_model_lock    = threading.Lock()

def _get_tree_model():
    global _tree_model
    if _tree_model is None:
        with _model_lock:
            if _tree_model is None:
                _tree_model = YOLO(TREE_WEIGHTS)
    return _tree_model

def _get_disease_model():
    global _disease_model
    if _disease_model is None:
        with _model_lock:
            if _disease_model is None:
                _disease_model = YOLO(DISEASE_WEIGHTS)
    return _disease_model

# ── Job state store ────────────────────────────────────────────────────────────
# session_id → {stage, status, progress, detail, result, error}
farm_map_jobs: dict = {}

def _update(session_id: str, stage: str, status: str, progress: int, detail: str = ''):
    farm_map_jobs[session_id].update({
        'stage':    stage,
        'status':   status,
        'progress': progress,
        'detail':   detail,
    })

# ── NMS ───────────────────────────────────────────────────────────────────────
def _nms(boxes, scores, iou_thr: float = 0.4):
    if not boxes:
        return []
    boxes  = np.array(boxes,  dtype=np.float32)
    scores = np.array(scores, dtype=np.float32)
    order  = scores.argsort()[::-1]
    keep   = []
    while order.size:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        area_i = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        area_j = ((boxes[order[1:], 2] - boxes[order[1:], 0]) *
                  (boxes[order[1:], 3] - boxes[order[1:], 1]))
        iou   = inter / (area_i + area_j - inter + 1e-6)
        order = order[1:][iou < iou_thr]
    return keep

# ── Stage 1: stitch ────────────────────────────────────────────────────────────
def _stitch(session_id: str, video_path: str, job_dir: str) -> str:
    _update(session_id, 'stitch', 'running', 2, 'Initialising stitcher…')

    sys.path.insert(0, _SRC_DIR)
    from stitch_opencv import stitch_video

    out_path = os.path.join(job_dir, 'orthophoto.png')

    def _cb(pct: int, detail: str):
        _update(session_id, 'stitch', 'running', max(2, min(pct, 98)), detail)

    result_path = stitch_video(video_path, out_path, 10, _cb)
    _update(session_id, 'stitch', 'done', 100, 'Orthomosaic ready')
    return result_path

# ── Stage 2: tile-detect trees ────────────────────────────────────────────────
def _detect(session_id: str, map_path: str, job_dir: str, conf: float):
    _update(session_id, 'detect', 'running', 0, 'Loading tree model…')
    model  = _get_tree_model()

    img_pil = Image.open(map_path).convert('RGB')
    img_w, img_h = img_pil.size
    map_np  = np.array(img_pil)

    step  = TILE_SIZE - OVERLAP
    tiles = [
        (x, y, min(x + TILE_SIZE, img_w), min(y + TILE_SIZE, img_h))
        for y in range(0, img_h, step)
        for x in range(0, img_w, step)
    ]
    total = len(tiles)
    all_boxes, all_scores, all_masks = [], [], []

    for idx, (tx, ty, tx2, ty2) in enumerate(tiles, 1):
        tile    = map_np[ty:ty2, tx:tx2]
        results = model.predict(source=tile, imgsz=1280,
                                conf=conf, iou=0.5, verbose=False)
        r = results[0]
        if r.boxes is not None:
            for j, box in enumerate(r.boxes):
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                all_boxes.append([x1 + tx, y1 + ty, x2 + tx, y2 + ty])
                all_scores.append(float(box.conf))
                if r.masks is not None:
                    pts = r.masks.xy[j] + np.array([tx, ty])
                    all_masks.append(pts.astype(np.int32))
                else:
                    all_masks.append(None)

        if idx % 4 == 0 or idx == total:
            _update(session_id, 'detect', 'running',
                    int(idx / total * 100), f'Scanning tile {idx}/{total}…')

    kept = _nms(all_boxes, all_scores, 0.4)

    # ── Draw annotated map + save crops ───────────────────────────────────────
    out   = map_np.copy()
    trees = []

    for tree_id, i in enumerate(kept, 1):
        x1, y1, x2, y2 = [int(v) for v in all_boxes[i]]
        cx, cy   = (x1 + x2) // 2, (y1 + y2) // 2
        conf_val = all_scores[i]

        if all_masks[i] is not None:
            overlay = out.copy()
            cv2.fillPoly(overlay, [all_masks[i]], (0, 200, 100))
            cv2.addWeighted(overlay, 0.25, out, 0.75, 0, out)
            cv2.polylines(out, [all_masks[i]], True, (0, 220, 80), 2)
        else:
            cv2.rectangle(out, (x1, y1), (x2, y2), (0, 220, 80), 2)

        # Label badge
        label = f'#{tree_id}'
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(out, (cx - lw // 2 - 3, cy - lh - 6),
                      (cx + lw // 2 + 3, cy), (0, 180, 60), -1)
        cv2.putText(out, label, (cx - lw // 2, cy - 3),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        # Save tree crop
        crop = map_np[
            max(0, y1 - CROP_PAD): y2 + CROP_PAD,
            max(0, x1 - CROP_PAD): x2 + CROP_PAD
        ]
        crop_name = f'tree_{tree_id:04d}.jpg'
        crop_path = os.path.join(job_dir, crop_name)
        if crop.size > 0:
            cv2.imwrite(crop_path, cv2.cvtColor(crop, cv2.COLOR_RGB2BGR),
                        [cv2.IMWRITE_JPEG_QUALITY, 88])

        trees.append({
            'tree_id':    tree_id,
            'cx_px':      cx,
            'cy_px':      cy,
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
            'confidence': round(conf_val, 4),
            'crop_file':  crop_name,
            'disease':    None,
            'disease_confidence': None,
            'all_detections': [],
        })

    # Save annotated map
    annotated_path = os.path.join(job_dir, 'detected_trees.png')
    cv2.imwrite(annotated_path, cv2.cvtColor(out, cv2.COLOR_RGB2BGR))

    # Save CSV
    csv_path = os.path.join(job_dir, 'tree_detections.csv')
    if trees:
        with open(csv_path, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=['tree_id', 'cx_px', 'cy_px',
                                               'x1', 'y1', 'x2', 'y2', 'confidence'])
            w.writeheader()
            w.writerows([{k: t[k] for k in w.fieldnames} for t in trees])

    # Save trees.json
    trees_path = os.path.join(job_dir, 'trees.json')
    with open(trees_path, 'w') as f:
        json.dump(trees, f)

    _update(session_id, 'detect', 'done', 100,
            f'{len(kept)} trees detected')
    return annotated_path, trees_path, len(kept)

# ── Master runner (called in background thread) ────────────────────────────────
def run_farm_map(session_id: str, video_path: str, settings: dict):
    job_dir = os.path.join(JOBS_DIR, session_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        farm_map_jobs[session_id]['status'] = 'running'
        conf = float(settings.get('conf', 0.35))

        # Stage 1
        map_path = _stitch(session_id, video_path, job_dir)

        # Stage 2
        annotated_path, trees_path, tree_count = _detect(
            session_id, map_path, job_dir, conf)

        # Encode map as base64 for immediate preview
        img = cv2.imread(annotated_path)
        _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 82])
        map_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()

        farm_map_jobs[session_id].update({
            'status':   'done',
            'stage':    'complete',
            'progress': 100,
            'detail':   f'Done — {tree_count} trees found',
            'result': {
                'tree_count':     tree_count,
                'map_b64':        map_b64,
                'annotated_path': annotated_path,
                'trees_path':     trees_path,
            },
        })

    except Exception as exc:
        import traceback
        traceback.print_exc()
        farm_map_jobs[session_id].update({
            'status': 'error',
            'error':  str(exc),
        })
    finally:
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
            except OSError:
                pass

# ── Disease analysis for a single tree crop ────────────────────────────────────
DISEASE_CLASSES = {
    0: 'Black Beetle Attack',
    1: 'Magnesium Deficiency',
    2: 'Potassium Deficiency',
    3: 'Yellow Patches',
}

def analyze_tree_disease(session_id: str, tree_id: int) -> dict | None:
    job_dir    = os.path.join(JOBS_DIR, session_id)
    trees_path = os.path.join(job_dir, 'trees.json')
    if not os.path.exists(trees_path):
        return None

    with open(trees_path) as f:
        trees = json.load(f)

    tree = next((t for t in trees if t['tree_id'] == tree_id), None)
    if not tree:
        return None

    crop_path = os.path.join(job_dir, tree['crop_file'])
    if not os.path.exists(crop_path):
        return None

    model  = _get_disease_model()
    img_bgr = cv2.imread(crop_path)
    results = model.predict(source=img_bgr, conf=0.20, verbose=False)

    detections = []
    r = results[0]
    if r.boxes is not None:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cnf    = float(box.conf[0])
            detections.append({
                'disease':    DISEASE_CLASSES.get(cls_id, f'Class {cls_id}'),
                'confidence': round(cnf, 3),
            })

    # Determine dominant disease
    if detections:
        top = max(detections, key=lambda d: d['confidence'])
        disease      = top['disease']
        disease_conf = top['confidence']
    else:
        disease      = 'Healthy'
        disease_conf = 1.0

    # Persist result in trees.json
    tree.update({
        'disease':             disease,
        'disease_confidence':  disease_conf,
        'all_detections':      detections,
    })
    with open(trees_path, 'w') as f:
        json.dump(trees, f)

    # Encode crop as base64
    _, buf = cv2.imencode('.jpg', img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    crop_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()

    return {
        'tree_id':             tree_id,
        'crop_image':          crop_b64,
        'disease':             disease,
        'disease_confidence':  disease_conf,
        'all_detections':      detections,
    }
