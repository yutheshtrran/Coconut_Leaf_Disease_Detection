"""
Farm Map Pipeline — adapted for Flask/threading (CLDD).
video → stitch orthomosaic → tile-detect trees → save crops → disease on demand
"""

import base64
import csv
import json
import math
import os
import sys
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from yaml import safe_load as _yaml_load

import cv2
import numpy as np
from PIL import Image

# BGR colours matching frontend DISEASE_PALETTE  (R,G,B → B,G,R)
_DISEASE_COLORS_BGR = {
    0: (68,  68,  239),  # Black Beetle Attack  #ef4444  red
    1: (247, 85,  168),  # Magnesium Deficiency #a855f7  violet
    2: (233, 165,  14),  # Potassium Deficiency #0ea5e9  sky-blue
    3: (8,   179, 234),  # Yellow Patches       #eab308  amber
}

def _plot_clean(image_bgr: np.ndarray, result,
                class_conf: dict = None, cls_name_map: dict = None) -> np.ndarray:
    """Semi-transparent fills + thin border, no text labels.
    Pass class_conf {name: min_conf} + cls_name_map {id: name} to enable per-class filtering."""
    out = image_bgr.copy()
    r   = result

    def _skip(cls_id, cnf):
        if class_conf is None or cls_name_map is None:
            return False
        return cnf < class_conf.get(cls_name_map.get(cls_id, ''), 0.0)

    if r.masks is not None and len(r.masks.xy):
        for i, pts in enumerate(r.masks.xy):
            cls_id = int(r.boxes.cls[i]) if r.boxes is not None else 0
            cnf    = float(r.boxes.conf[i]) if r.boxes is not None else 1.0
            if _skip(cls_id, cnf):
                continue
            color  = _DISEASE_COLORS_BGR.get(cls_id, (128, 128, 128))
            poly   = pts.astype(np.int32)
            ov     = out.copy()
            cv2.fillPoly(ov, [poly], color)
            cv2.addWeighted(ov, 0.28, out, 0.72, 0, out)
            cv2.polylines(out, [poly], isClosed=True, color=color, thickness=2)
    elif r.boxes is not None:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cnf    = float(box.conf[0])
            if _skip(cls_id, cnf):
                continue
            color         = _DISEASE_COLORS_BGR.get(cls_id, (128, 128, 128))
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            ov = out.copy()
            cv2.rectangle(ov, (x1, y1), (x2, y2), color, -1)
            cv2.addWeighted(ov, 0.25, out, 0.75, 0, out)
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
    return out

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

# ── Paths ──────────────────────────────────────────────────────────────────────
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))  # ml/src
_ML_DIR  = os.path.dirname(_SRC_DIR)                   # ml

TREE_WEIGHTS    = os.path.join(_ML_DIR, 'weights', 'tree_v6-3',   'weights', 'best.pt')
DISEASE_WEIGHTS = os.path.join(_ML_DIR, 'weights', 'disease_v5', 'weights', 'best.pt')
JOBS_DIR        = os.path.join(_ML_DIR, 'farm_map_jobs')
os.makedirs(JOBS_DIR, exist_ok=True)

# ── Detection constants ────────────────────────────────────────────────────────
TILE_SIZE = 1280
OVERLAP   = 256
CROP_PAD  = 24
# MERGE_RADIUS loaded from config.yaml (merge_radius key, default 120)

# ── Thresholds — edit config.yaml to change these ─────────────────────────────
_cfg_path = os.path.join(_SRC_DIR, 'config.yaml')
with open(_cfg_path) as _f:
    _cfg = _yaml_load(_f)
CONF_TREE    = float(_cfg.get('conf_tree',    0.35))
CONF_DISEASE = float(_cfg.get('conf_disease', 0.20))
IOU_TREE     = float(_cfg.get('iou_tree',     0.50))
MERGE_RADIUS = float(_cfg.get('merge_radius', 120))

# Per-class disease thresholds {disease_name: min_conf}.
# Falls back to CONF_DISEASE for any class not listed.
_raw_cls = _cfg.get('conf_disease_classes') or {}
CONF_DISEASE_CLASSES: dict = {k: float(v) for k, v in _raw_cls.items()}
# Lowest per-class threshold — used as the YOLO inference conf so no class is
# silently dropped by the model; post-filtering applies per-class thresholds.
_CONF_DISEASE_MIN = min(CONF_DISEASE_CLASSES.values(), default=CONF_DISEASE) if CONF_DISEASE_CLASSES else CONF_DISEASE

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

    # Free any fragmented GPU memory before importing the stitcher,
    # then force it to run on CPU so it doesn't compete with YOLO/inference models.
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    from stitch_opencv import stitch_video
    import stitch_opencv as _stitch_mod
    import gpu_warp

    # Force the stitcher to run on CPU — the GPU is needed by YOLO/inference models
    # and the 6 GB VRAM can't fit both. All stitcher code has CPU fallbacks.
    _cpu = __import__('torch').device('cpu')
    _orig_gw_device  = gpu_warp.DEVICE
    _orig_gw_use_gpu = gpu_warp._USE_GPU
    _orig_sc_device  = _stitch_mod.DEVICE   # stitch_opencv imported DEVICE as its own name
    try:
        gpu_warp.DEVICE      = _cpu
        gpu_warp._USE_GPU    = False
        _stitch_mod.DEVICE   = _cpu         # makes _disk_lg_H / _sp_lg_H / _loftr_H skip GPU

        out_path = os.path.join(job_dir, 'orthophoto.png')

        def _cb(pct: int, detail: str):
            _update(session_id, 'stitch', 'running', max(2, min(pct, 98)), detail)

        result_path = stitch_video(video_path, out_path, 10, _cb)
    finally:
        gpu_warp.DEVICE      = _orig_gw_device
        gpu_warp._USE_GPU    = _orig_gw_use_gpu
        _stitch_mod.DEVICE   = _orig_sc_device

    _update(session_id, 'detect', 'running', 0, 'Orthomosaic ready — starting tree detection…')
    return result_path

# ── Canvas projection helper ───────────────────────────────────────────────────
def _project_to_canvas(det, transform):
    """Project a frame-space bbox (x1,y1,x2,y2) to canvas centroid + bbox."""
    T = np.array(transform, dtype=np.float64)
    cx_f = (det['x1'] + det['x2']) / 2
    cy_f = (det['y1'] + det['y2']) / 2
    points = np.array([
        [cx_f, cy_f],
        [det['x1'], det['y1']], [det['x2'], det['y1']],
        [det['x2'], det['y2']], [det['x1'], det['y2']],
    ], dtype=np.float64)
    pts_h = np.hstack([points, np.ones((5, 1))])
    proj  = (T @ pts_h.T).T
    proj /= proj[:, 2:3]
    cx, cy  = proj[0, 0], proj[0, 1]
    corners = proj[1:, :2]
    return cx, cy, corners[:, 0].min(), corners[:, 1].min(), corners[:, 0].max(), corners[:, 1].max()


# ── Stage 2 + disease: frame-based detection ──────────────────────────────────
def _detect_from_frames(session_id: str, video_path: str, job_dir: str, conf: float):
    """
    Detect trees from individual video frames (not the blended orthomosaic).
    Uses trajectory.json to project detections to canvas space, deduplicates
    with centroid-distance clustering, then pre-analyses disease for every tree.
    """
    _update(session_id, 'detect', 'running', 0, 'Loading trajectory…')

    traj_path = os.path.join(job_dir, 'trajectory.json')
    if not os.path.exists(traj_path):
        raise RuntimeError('trajectory.json not found — stitching may have failed silently')
    with open(traj_path) as f:
        traj = json.load(f)

    frame_indices = traj['frame_indices']
    transforms    = traj['transforms']
    fw_orig, fh_orig = traj['orig_frame_wh']
    N = len(frame_indices)

    tree_model = _get_tree_model()

    # ── Pass A: YOLO on each trajectory frame ─────────────────────────────────
    raw_detections = []
    cap = cv2.VideoCapture(video_path)
    try:
        frame_counter = 0
        traj_idx      = 0
        while traj_idx < N:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_counter == frame_indices[traj_idx]:
                r = tree_model.predict(source=frame, imgsz=1280,
                                       conf=conf, iou=IOU_TREE, verbose=False)[0]
                if r.boxes is not None:
                    for j, box in enumerate(r.boxes):
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
                        raw_detections.append({
                            'traj_idx':  traj_idx,
                            'frame_fno': frame_indices[traj_idx],
                            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                            'conf': float(box.conf[0]),
                        })
                traj_idx += 1
                if traj_idx % 10 == 0 or traj_idx == N:
                    _update(session_id, 'detect', 'running',
                            int(traj_idx / N * 60),
                            f'Frame detection {traj_idx}/{N}…')
            frame_counter += 1
    finally:
        cap.release()

    # ── No trees found — write empty outputs ──────────────────────────────────
    if not raw_detections:
        ortho = os.path.join(job_dir, 'orthophoto.png')
        annotated_path = os.path.join(job_dir, 'detected_trees.png')
        if os.path.exists(ortho):
            import shutil; shutil.copy2(ortho, annotated_path)
        trees_path = os.path.join(job_dir, 'trees.json')
        with open(trees_path, 'w') as f:
            json.dump([], f)
        return annotated_path, trees_path, 0

    # ── Pass B: project to canvas space ───────────────────────────────────────
    for det in raw_detections:
        cx, cy, cx1, cy1, cx2, cy2 = _project_to_canvas(det, transforms[det['traj_idx']])
        det.update({'canvas_cx': cx, 'canvas_cy': cy,
                    'canvas_x1': cx1, 'canvas_y1': cy1,
                    'canvas_x2': cx2, 'canvas_y2': cy2})

    # ── Pass C: two-stage deduplication ───────────────────────────────────────
    #
    # Stage C1 — canvas-space IoU NMS (iou_thr=0.10, very permissive).
    # Merges the same physical tree detected in nearby frames where their
    # projected boxes significantly overlap.  Low threshold because projection
    # parallax shrinks apparent box overlap.
    c_boxes  = [[d['canvas_x1'], d['canvas_y1'], d['canvas_x2'], d['canvas_y2']]
                for d in raw_detections]
    c_scores = [d['conf'] for d in raw_detections]
    dets_c1  = [raw_detections[i] for i in _nms(c_boxes, c_scores, iou_thr=0.10)]

    # Stage C2 — adaptive centroid clustering.
    # Handles the same tree seen from distant frames where parallax moves the
    # projected centroid more than MERGE_RADIUS but still within one crown width.
    # Merge radius = max(60% of projected box diagonal, MERGE_RADIUS constant).
    def _adaptive_r(det):
        w = abs(det['canvas_x2'] - det['canvas_x1'])
        h = abs(det['canvas_y2'] - det['canvas_y1'])
        return max(math.hypot(w, h) * 0.6, MERGE_RADIUS)

    sorted_dets = sorted(dets_c1, key=lambda d: d['conf'], reverse=True)
    suppressed  = [False] * len(sorted_dets)
    clusters    = []
    for i, det_i in enumerate(sorted_dets):
        if suppressed[i]:
            continue
        r_i     = _adaptive_r(det_i)
        cluster = [det_i]
        for j in range(i + 1, len(sorted_dets)):
            if suppressed[j]:
                continue
            r_j  = _adaptive_r(sorted_dets[j])
            dist = math.hypot(det_i['canvas_cx'] - sorted_dets[j]['canvas_cx'],
                              det_i['canvas_cy'] - sorted_dets[j]['canvas_cy'])
            if dist < max(r_i, r_j):
                cluster.append(sorted_dets[j])
                suppressed[j] = True
        clusters.append(cluster)
        suppressed[i] = True

    # ── Pass D: best-frame scoring (centre of frame = least distortion) ────────
    half_diag = math.hypot(fw_orig / 2, fh_orig / 2)

    def _score(det):
        bx = (det['x1'] + det['x2']) / 2
        by = (det['y1'] + det['y2']) / 2
        return det['conf'] * (1.0 - math.hypot(bx - fw_orig / 2, by - fh_orig / 2) / half_diag)

    unique_trees = []
    for tree_id, cluster in enumerate(clusters, 1):
        best = max(cluster, key=_score)
        mean_cx = int(round(sum(d['canvas_cx'] for d in cluster) / len(cluster)))
        mean_cy = int(round(sum(d['canvas_cy'] for d in cluster) / len(cluster)))
        unique_trees.append({
            'tree_id':            tree_id,
            'cx_px':              mean_cx,
            'cy_px':              mean_cy,
            'x1_canvas':          int(round(min(d['canvas_x1'] for d in cluster))),
            'y1_canvas':          int(round(min(d['canvas_y1'] for d in cluster))),
            'x2_canvas':          int(round(max(d['canvas_x2'] for d in cluster))),
            'y2_canvas':          int(round(max(d['canvas_y2'] for d in cluster))),
            'frame_fno':          best['frame_fno'],
            'x1_frame':           int(best['x1']), 'y1_frame': int(best['y1']),
            'x2_frame':           int(best['x2']), 'y2_frame': int(best['y2']),
            'confidence':         round(best['conf'], 4),
            'crop_file':          f'tree_{tree_id:04d}.jpg',
            'disease':            None,
            'disease_confidence': None,
            'all_detections':     [],
            'crop_image':         '',
        })

    # ── Pass E: batch disease pre-analysis (seek-read per unique frame) ────────
    _update(session_id, 'disease', 'running', 0,
            f'Pre-analysing disease for {len(unique_trees)} trees…')

    disease_model  = _get_disease_model()
    frame_to_trees = defaultdict(list)
    for tree in unique_trees:
        frame_to_trees[tree['frame_fno']].append(tree)

    processed   = 0
    total_trees = len(unique_trees)

    cap2 = cv2.VideoCapture(video_path)
    try:
        for frame_fno, tree_list in sorted(frame_to_trees.items()):
            cap2.set(cv2.CAP_PROP_POS_FRAMES, frame_fno)
            ret, frame = cap2.read()
            if not ret:
                for tree in tree_list:
                    tree.update({'disease': 'Healthy', 'disease_confidence': 1.0,
                                 'all_detections': [], 'crop_image': ''})
                    processed += 1
                continue

            fh, fw = frame.shape[:2]
            for tree in tree_list:
                x1 = max(0, tree['x1_frame'] - CROP_PAD)
                y1 = max(0, tree['y1_frame'] - CROP_PAD)
                x2 = min(fw, tree['x2_frame'] + CROP_PAD)
                y2 = min(fh, tree['y2_frame'] + CROP_PAD)
                crop = frame[y1:y2, x1:x2]

                if crop.size == 0:
                    tree.update({'disease': 'Healthy', 'disease_confidence': 1.0,
                                 'all_detections': [], 'crop_image': ''})
                    processed += 1
                    continue

                cv2.imwrite(os.path.join(job_dir, tree['crop_file']),
                            crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
                try:
                    dr = disease_model.predict(source=crop, conf=_CONF_DISEASE_MIN,
                                               verbose=False)[0]
                    annotated = _plot_clean(crop.copy(), dr, CONF_DISEASE_CLASSES, DISEASE_CLASSES)
                    detections = []
                    if dr.boxes is not None:
                        for dbox in dr.boxes:
                            cls_id   = int(dbox.cls[0])
                            cnf      = float(dbox.conf[0])
                            cls_name = DISEASE_CLASSES.get(cls_id, f'Class {cls_id}')
                            if cnf < CONF_DISEASE_CLASSES.get(cls_name, CONF_DISEASE):
                                continue
                            detections.append({'disease': cls_name,
                                               'confidence': round(cnf, 3)})
                    if detections:
                        top = max(detections, key=lambda d: d['confidence'])
                        disease, disease_conf = top['disease'], top['confidence']
                    else:
                        disease, disease_conf = 'Healthy', 1.0
                    _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
                    crop_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()
                except Exception:
                    disease, disease_conf, detections, crop_b64 = 'Healthy', 1.0, [], ''

                tree.update({'disease': disease, 'disease_confidence': disease_conf,
                             'all_detections': detections, 'crop_image': crop_b64})
                processed += 1
                _update(session_id, 'disease', 'running',
                        int(processed / total_trees * 100),
                        f'Disease analysis {processed}/{total_trees} trees…')
    finally:
        cap2.release()

    # ── Pass F: draw disease-coloured markers on orthomosaic ──────────────────
    ortho_path = os.path.join(job_dir, 'orthophoto.png')
    if os.path.exists(ortho_path):
        map_np = np.array(Image.open(ortho_path).convert('RGB'))
    else:
        cw, ch = traj['canvas_wh']
        map_np = np.zeros((int(ch), int(cw), 3), dtype=np.uint8)

    out   = map_np.copy()
    _d2c  = {v: k for k, v in DISEASE_CLASSES.items()}
    GREEN = (0, 200, 100)
    for tree in unique_trees:
        cx, cy = tree['cx_px'], tree['cy_px']
        color  = _DISEASE_COLORS_BGR.get(_d2c.get(tree['disease']), GREEN)
        cv2.circle(out, (cx, cy), 14, color, -1)
        cv2.circle(out, (cx, cy), 14, (255, 255, 255), 2)
        label = f'#{tree["tree_id"]}'
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(out, (cx - lw // 2 - 2, cy - lh - 5),
                      (cx + lw // 2 + 2, cy - 1), color, -1)
        cv2.putText(out, label, (cx - lw // 2, cy - 3),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

    annotated_path = os.path.join(job_dir, 'detected_trees.png')
    cv2.imwrite(annotated_path, cv2.cvtColor(out, cv2.COLOR_RGB2BGR))

    trees_path = os.path.join(job_dir, 'trees.json')
    with open(trees_path, 'w') as f:
        json.dump(unique_trees, f)

    csv_path = os.path.join(job_dir, 'tree_detections.csv')
    if unique_trees:
        fieldnames = ['tree_id', 'cx_px', 'cy_px', 'frame_fno',
                      'x1_frame', 'y1_frame', 'x2_frame', 'y2_frame',
                      'confidence', 'disease', 'disease_confidence']
        with open(csv_path, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows([{k: t.get(k) for k in fieldnames} for t in unique_trees])

    _update(session_id, 'disease', 'running', 100,
            f'{len(unique_trees)} trees analysed — finalising…')
    return annotated_path, trees_path, len(unique_trees)


# ── Stage 2 fallback: tile-detect on orthomosaic (used if trajectory.json absent) ──
def _detect_ortho(session_id: str, map_path: str, job_dir: str, conf: float):
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
                                conf=conf, iou=IOU_TREE, verbose=False)
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

    _update(session_id, 'detect', 'running', 100,
            f'{len(kept)} trees detected — finalising…')
    return annotated_path, trees_path, len(kept)

# ── Master runner (called in background thread) ────────────────────────────────
def run_farm_map(session_id: str, video_path: str, settings: dict):
    job_dir = os.path.join(JOBS_DIR, session_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        farm_map_jobs[session_id]['status'] = 'running'
        conf = float(settings.get('conf', CONF_TREE))

        # Stage 1
        map_path = _stitch(session_id, video_path, job_dir)

        # Stage 2 + disease pre-analysis
        # Prefer frame-based detection (uses trajectory.json for clean crops).
        # Falls back to tiled orthomosaic detection if trajectory is missing.
        traj_path = os.path.join(job_dir, 'trajectory.json')
        if os.path.exists(traj_path):
            annotated_path, trees_path, tree_count = _detect_from_frames(
                session_id, video_path, job_dir, conf)
        else:
            annotated_path, trees_path, tree_count = _detect_ortho(
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
        import traceback as _tb
        tb_str = _tb.format_exc()
        print(tb_str)
        err_msg = str(exc) or repr(exc) or type(exc).__name__
        farm_map_jobs[session_id].update({
            'status': 'error',
            'error':  err_msg,
            'traceback': tb_str,
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

    # Return pre-computed result if available (set by _detect_from_frames)
    if tree.get('crop_image') and tree.get('disease'):
        return {
            'tree_id':            tree_id,
            'crop_image':         tree['crop_image'],
            'disease':            tree['disease'],
            'disease_confidence': tree.get('disease_confidence', 1.0),
            'all_detections':     tree.get('all_detections', []),
        }

    # Fallback: re-run inference on saved crop file
    crop_path = os.path.join(job_dir, tree.get('crop_file', f'tree_{tree_id:04d}.jpg'))
    if not os.path.exists(crop_path):
        return None

    model   = _get_disease_model()
    img_bgr = cv2.imread(crop_path)
    results = model.predict(source=img_bgr, conf=_CONF_DISEASE_MIN, verbose=False)

    r = results[0]

    annotated_bgr = _plot_clean(img_bgr.copy(), r, CONF_DISEASE_CLASSES, DISEASE_CLASSES)
    _, buf = cv2.imencode('.jpg', annotated_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    crop_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()

    detections = []
    if r.boxes is not None:
        for box in r.boxes:
            cls_id   = int(box.cls[0])
            cnf      = float(box.conf[0])
            cls_name = DISEASE_CLASSES.get(cls_id, f'Class {cls_id}')
            if cnf < CONF_DISEASE_CLASSES.get(cls_name, CONF_DISEASE):
                continue
            detections.append({
                'disease':    cls_name,
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

    return {
        'tree_id':             tree_id,
        'crop_image':          crop_b64,
        'disease':             disease,
        'disease_confidence':  disease_conf,
        'all_detections':      detections,
    }


# ── Single drone top-view image: tree detection → per-tree disease ────────────
def analyze_drone_image(image_path: str, conf: float = None) -> dict:
    """
    Detect trees in a single drone top-view image using the tree model, then run
    disease_v5 on each detected tree crop.  Returns the annotated full image and
    per-tree results (disease, confidence, annotated crop).
    """
    tree_model    = _get_tree_model()
    disease_model = _get_disease_model()

    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise RuntimeError(f'Cannot read image: {image_path}')
    img_h, img_w = img_bgr.shape[:2]

    # ── Tree detection ────────────────────────────────────────────────────────
    _conf   = conf if conf is not None else CONF_TREE
    results = tree_model.predict(source=img_bgr, imgsz=1280,
                                  conf=_conf, iou=IOU_TREE, verbose=False)
    r   = results[0]
    out = img_bgr.copy()
    trees = []

    if r.boxes is not None:
        for i, box in enumerate(r.boxes):
            tree_id         = i + 1
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            cx, cy          = (x1 + x2) // 2, (y1 + y2) // 2
            tree_conf       = float(box.conf[0])

            # ── Padded crop ──────────────────────────────────────────────────
            cx1  = max(0, x1 - CROP_PAD);      cy1  = max(0, y1 - CROP_PAD)
            cx2  = min(img_w, x2 + CROP_PAD);  cy2  = min(img_h, y2 + CROP_PAD)
            crop = img_bgr[cy1:cy2, cx1:cx2]

            # Mask background before disease detection: zero-out every pixel
            # outside the tree's own segmentation polygon so the disease model
            # only sees canopy, not soil / surrounding vegetation.
            ch, cw = crop.shape[:2]
            if r.masks is not None:
                tree_pts_full = r.masks.xy[i].astype(np.float32)
                tree_pts_crop = (tree_pts_full - np.array([cx1, cy1],
                                  dtype=np.float32)).astype(np.int32)
                tree_pts_crop[:, 0] = np.clip(tree_pts_crop[:, 0], 0, cw - 1)
                tree_pts_crop[:, 1] = np.clip(tree_pts_crop[:, 1], 0, ch - 1)
                seg_mask = np.zeros((ch, cw), dtype=np.uint8)
                cv2.fillPoly(seg_mask, [tree_pts_crop], 255)
                masked_crop = crop.copy()
                masked_crop[seg_mask == 0] = 0   # black out background
            else:
                masked_crop = crop

            # ── Disease on masked crop ────────────────────────────────────────
            dr             = disease_model.predict(source=masked_crop, conf=_CONF_DISEASE_MIN, verbose=False)[0]
            annotated_crop = _plot_clean(crop.copy(), dr, CONF_DISEASE_CLASSES, DISEASE_CLASSES)

            detections = []
            if dr.boxes is not None:
                for dbox in dr.boxes:
                    cls_id   = int(dbox.cls[0])
                    cnf      = float(dbox.conf[0])
                    cls_name = DISEASE_CLASSES.get(cls_id, f'Class {cls_id}')
                    if cnf < CONF_DISEASE_CLASSES.get(cls_name, CONF_DISEASE):
                        continue
                    detections.append({
                        'disease':    cls_name,
                        'confidence': round(cnf, 3),
                    })

            if detections:
                top          = max(detections, key=lambda d: d['confidence'])
                disease      = top['disease'];  disease_conf = top['confidence']
            else:
                disease      = 'Healthy';       disease_conf = 1.0

            # colour for rect border / badge (healthy=green, diseased=disease colour)
            _d2c  = {v: k for k, v in DISEASE_CLASSES.items()}
            color = _DISEASE_COLORS_BGR.get(_d2c.get(disease), (0, 200, 100))

            # ── Full image: rectangle border (disease-coloured) ───────────────
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)

            # Disease polygons / boxes drawn on the full image.
            # Because the crop was pre-masked to the tree polygon, all disease
            # detections are already confined to canopy pixels — no background
            # spill.  We simply offset crop-space coords by (cx1, cy1) to land
            # them in full-image space.
            if disease != 'Healthy':
                if dr.masks is not None and len(dr.masks.xy):
                    for j, pts_crop in enumerate(dr.masks.xy):
                        dis_cls  = int(dr.boxes.cls[j]) if dr.boxes is not None else 0
                        dis_cnf  = float(dr.boxes.conf[j]) if dr.boxes is not None else 1.0
                        dis_name = DISEASE_CLASSES.get(dis_cls, '')
                        if dis_cnf < CONF_DISEASE_CLASSES.get(dis_name, CONF_DISEASE):
                            continue
                        pts_full  = (pts_crop + np.array([cx1, cy1])).astype(np.int32)
                        dis_color = _DISEASE_COLORS_BGR.get(dis_cls, (128, 128, 128))
                        ov = out.copy()
                        cv2.fillPoly(ov, [pts_full], dis_color)
                        cv2.addWeighted(ov, 0.30, out, 0.70, 0, out)
                        cv2.polylines(out, [pts_full], True, dis_color, 2)
                elif dr.boxes is not None:
                    for dbox in dr.boxes:
                        dis_cls  = int(dbox.cls[0])
                        dis_cnf  = float(dbox.conf[0])
                        dis_name = DISEASE_CLASSES.get(dis_cls, '')
                        if dis_cnf < CONF_DISEASE_CLASSES.get(dis_name, CONF_DISEASE):
                            continue
                        dx1b, dy1b, dx2b, dy2b = map(int, dbox.xyxy[0].tolist())
                        fx1 = max(x1, dx1b + cx1);  fy1 = max(y1, dy1b + cy1)
                        fx2 = min(x2, dx2b + cx1);  fy2 = min(y2, dy2b + cy1)
                        dis_color = _DISEASE_COLORS_BGR.get(dis_cls, (128, 128, 128))
                        ov = out.copy()
                        cv2.rectangle(ov, (fx1, fy1), (fx2, fy2), dis_color, -1)
                        cv2.addWeighted(ov, 0.30, out, 0.70, 0, out)
                        cv2.rectangle(out, (fx1, fy1), (fx2, fy2), dis_color, 2)

            # Number badge pinned to top-left corner of the rectangle
            label       = f'#{tree_id}'
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            bx1, by1    = x1, max(0, y1 - lh - 6)
            bx2, by2    = x1 + lw + 6, y1
            cv2.rectangle(out, (bx1, by1), (bx2, by2), color, -1)
            cv2.putText(out, label, (bx1 + 3, by2 - 3),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

            # ── Encode annotated crop ─────────────────────────────────────────
            _, buf   = cv2.imencode('.jpg', annotated_crop, [cv2.IMWRITE_JPEG_QUALITY, 88])
            crop_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()

            trees.append({
                'tree_id':            tree_id,
                'cx_px': cx, 'cy_px': cy,
                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                'confidence':         round(tree_conf, 4),
                'disease':            disease,
                'disease_confidence': disease_conf,
                'all_detections':     detections,
                'crop_image':         crop_b64,
            })

    # ── Encode full annotated image ───────────────────────────────────────────
    _, buf        = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 82])
    annotated_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()

    return {
        'tree_count':    len(trees),
        'annotated_b64': annotated_b64,
        'trees':         trees,
    }
