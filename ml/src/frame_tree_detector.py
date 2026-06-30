"""
Frame Tree Map — accurate detection pipeline.

Architecture:
  1. detect_map   — tile the stitched orthomosaic, run YOLOv8 on each tile, NMS merge.
                    Positions are exact because we work directly on the final image.
  2. find_crops   — for each detected tree, scan sampled video frames; inverse-project
                    the map bbox back to frame space; pick the sharpest, most-centred
                    original-frame crop. No stitching artifacts.
  3. build_map    — draw bounding boxes on the orthomosaic; save per-tree crops.
"""

import json
import math
import os

import cv2
import numpy as np

TILE_SIZE      = 1280
TILE_OVERLAP   = 512   # 40% overlap — ensures large crowns appear whole in ≥1 tile
NMS_IOU        = 0.20  # generous: catches partial-overlap siblings from tile edges
CENTROID_MERGE = 150   # px — post-NMS centroid distance to merge remaining splits
DETECT_STEP    = 30    # scan every Nth video frame for best-crop search
CROP_PAD       = 0.05
CROP_QUALITY   = 95


# ── NMS ───────────────────────────────────────────────────────────────────────

def _centroid_merge(boxes: list, scores: list, radius: float) -> list:
    """
    Post-NMS centroid-distance merge.
    If two surviving detections have centres within `radius` pixels,
    they are partial detections of the same tree — keep the higher-confidence
    one and absorb the smaller one's bbox into a union box.
    Returns indices of kept detections (with merged bboxes written in-place).
    """
    if not boxes:
        return []
    order = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)
    suppressed = [False] * len(boxes)

    for pos, i in enumerate(order):
        if suppressed[i]:
            continue
        cx_i = (boxes[i][0] + boxes[i][2]) / 2
        cy_i = (boxes[i][1] + boxes[i][3]) / 2
        for j in order[pos + 1:]:
            if suppressed[j]:
                continue
            cx_j = (boxes[j][0] + boxes[j][2]) / 2
            cy_j = (boxes[j][1] + boxes[j][3]) / 2
            if math.hypot(cx_i - cx_j, cy_i - cy_j) <= radius:
                # Absorb j's extent into i's box, then suppress j
                boxes[i][0] = min(boxes[i][0], boxes[j][0])
                boxes[i][1] = min(boxes[i][1], boxes[j][1])
                boxes[i][2] = max(boxes[i][2], boxes[j][2])
                boxes[i][3] = max(boxes[i][3], boxes[j][3])
                suppressed[j] = True

    return [i for i in order if not suppressed[i]]


def _nms_boxes(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> list:
    order = scores.argsort()[::-1]
    keep  = []
    while order.size:
        i = order[0]
        keep.append(int(i))
        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        ai = (boxes[i,2]-boxes[i,0]) * (boxes[i,3]-boxes[i,1])
        aj = ((boxes[order[1:],2]-boxes[order[1:],0]) *
              (boxes[order[1:],3]-boxes[order[1:],1]))
        iou   = inter / (ai + aj - inter + 1e-6)
        order = order[1:][iou < iou_thresh]
    return keep


# ── quality scorer ────────────────────────────────────────────────────────────

def _quality(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> tuple:
    """(sharpness, centrality) of a bbox region in a frame."""
    fh, fw = frame.shape[:2]
    crop = frame[max(0,y1):min(fh,y2), max(0,x1):min(fw,x2)]
    if crop.size == 0:
        return 0.0, 0.0
    gray      = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    dist      = math.hypot((x1+x2)/2 - fw/2, (y1+y2)/2 - fh/2)
    centrality = 1.0 - dist / math.hypot(fw/2, fh/2)
    return sharpness, centrality


# ── Stage 1: detect on stitched orthomosaic ───────────────────────────────────

def _detect_on_map(map_path: str, tree_model, conf: float,
                   nms_iou: float, centroid_merge_r: float, emit) -> list:
    """
    Tile the orthomosaic and run YOLOv8 on each tile.
    Merge tile-local detections back to map space, then NMS.
    Returns list of {id, map_bbox, map_cx, map_cy, confidence}.
    """
    img = cv2.imread(map_path)
    if img is None:
        raise RuntimeError(f'Cannot read orthomosaic: {map_path}')
    img_h, img_w = img.shape[:2]

    step  = TILE_SIZE - TILE_OVERLAP
    tiles = [(x, y, min(x + TILE_SIZE, img_w), min(y + TILE_SIZE, img_h))
             for y in range(0, img_h, step)
             for x in range(0, img_w, step)]

    all_boxes:  list[list[float]] = []
    all_scores: list[float]       = []

    for idx, (tx, ty, tx2, ty2) in enumerate(tiles, 1):
        tile   = img[ty:ty2, tx:tx2]
        result = tree_model.predict(
            tile, imgsz=TILE_SIZE, conf=conf, iou=0.5, verbose=False
        )[0]

        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                all_boxes.append([x1 + tx, y1 + ty, x2 + tx, y2 + ty])
                all_scores.append(float(box.conf))

        if idx % 10 == 0 or idx == len(tiles):
            emit(int(idx / len(tiles) * 100),
                 f'Tile {idx}/{len(tiles)} — {len(all_boxes)} raw detections…')

    if not all_boxes:
        emit(100, 'No trees detected on map')
        return []

    emit(90, f'{len(all_boxes)} raw detections — running NMS…')

    # Pass 1: IoU-based NMS to merge tile-edge overlaps
    boxes_np  = np.array(all_boxes,  dtype=np.float32)
    scores_np = np.array(all_scores, dtype=np.float32)
    keep1     = _nms_boxes(boxes_np, scores_np, nms_iou)

    # Work with mutable lists for centroid merge
    kept_boxes  = [list(all_boxes[i])  for i in keep1]
    kept_scores = [all_scores[i]       for i in keep1]

    # Pass 2: centroid-distance merge — catches partial-crown siblings that
    # survived NMS because their IoU was too low
    keep2 = _centroid_merge(kept_boxes, kept_scores, centroid_merge_r)

    trees = []
    for tree_id, i in enumerate(keep2, 1):
        x1, y1, x2, y2 = [int(v) for v in kept_boxes[i]]
        trees.append({
            'id':         tree_id,
            'map_bbox':   [x1, y1, x2, y2],
            'map_cx':     (x1 + x2) // 2,
            'map_cy':     (y1 + y2) // 2,
            'confidence': round(kept_scores[i], 4),
        })

    emit(100, f'{len(all_boxes)} raw → {len(keep1)} after NMS → {len(trees)} after centroid merge')
    return trees


# ── Stage 2: find best crop per tree ─────────────────────────────────────────

def _find_best_crops(trees: list, video_path: str, trajectory_path: str,
                     detect_step: int, emit) -> list:
    """
    For each tree's map_bbox, scan sampled video frames and find the
    frame where that tree is best visible (sharpest + most centred).
    Inverse-projects the map bbox to frame space using T_inv.
    """
    if not trees:
        return trees

    with open(trajectory_path) as f:
        traj = json.load(f)

    traj_indices = np.array(traj['frame_indices'], dtype=np.int64)
    # T maps original_frame → canvas; T_inv maps canvas → original_frame
    T_invs = [np.linalg.inv(np.array(T, dtype=np.float64))
               for T in traj['transforms']]

    # Per-tree best candidate {score, frame_idx, bbox_frame}
    best: dict[int, dict] = {
        t['id']: {'score': -1.0, 'frame_idx': -1, 'bbox_frame': None}
        for t in trees
    }

    cap     = cv2.VideoCapture(video_path)
    total_f = max(1, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
    sampled = 0
    fno     = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if fno % detect_step == 0:
            sampled += 1
            ci    = int(np.argmin(np.abs(traj_indices - fno)))
            T_inv = T_invs[ci]
            fh, fw = frame.shape[:2]

            for tree in trees:
                mx1, my1, mx2, my2 = tree['map_bbox']
                map_cx = (mx1 + mx2) / 2
                map_cy = (my1 + my2) / 2

                # Project map centre back to frame space
                ph = T_inv @ np.array([map_cx, map_cy, 1.0], dtype=np.float64)
                fx, fy = ph[0] / ph[2], ph[1] / ph[2]

                # Skip if centre lands outside frame (with margin)
                margin = 20
                if not (margin <= fx < fw - margin and margin <= fy < fh - margin):
                    continue

                # Project all 4 bbox corners to get frame-space bbox
                corners = [(mx1,my1),(mx2,my1),(mx2,my2),(mx1,my2)]
                fpts = []
                for cx, cy in corners:
                    p = T_inv @ np.array([cx, cy, 1.0], dtype=np.float64)
                    fpts.append((p[0]/p[2], p[1]/p[2]))

                fx1 = max(0,  int(min(p[0] for p in fpts)))
                fy1 = max(0,  int(min(p[1] for p in fpts)))
                fx2 = min(fw, int(max(p[0] for p in fpts)))
                fy2 = min(fh, int(max(p[1] for p in fpts)))

                if fx2 - fx1 < 8 or fy2 - fy1 < 8:
                    continue

                sharp, cent = _quality(frame, fx1, fy1, fx2, fy2)
                score = sharp * cent

                tid = tree['id']
                if score > best[tid]['score']:
                    best[tid] = {
                        'score':      score,
                        'frame_idx':  fno,
                        'bbox_frame': [fx1, fy1, fx2, fy2],
                    }

            if sampled % 10 == 0 or fno >= total_f - detect_step:
                pct = min(99, int(fno / total_f * 100))
                emit(pct, f'Frame {fno}/{total_f} — scanning for best crops…')

        fno += 1

    cap.release()
    emit(100, f'Best crops found for {sum(1 for b in best.values() if b["frame_idx"] >= 0)} trees')

    # Attach results to tree records
    for tree in trees:
        b = best[tree['id']]
        tree['best_frame_idx']  = b['frame_idx']
        tree['bbox_frame_best'] = b['bbox_frame']   # frame-space bbox for crop extraction
        tree['best_sharpness']  = round(b['score'], 1)

    return trees


# ── Stage 3: annotate map + save crops ───────────────────────────────────────

def _annotate_and_save(trees: list, job_dir: str, video_path: str, emit) -> None:
    """
    Draw bounding boxes on the stitched orthomosaic.
    Extract each tree's best original-frame crop to tree_crops/.
    """
    crops_dir  = os.path.join(job_dir, 'tree_crops')
    os.makedirs(crops_dir, exist_ok=True)

    ortho_path = os.path.join(job_dir, 'orthophoto.png')
    canvas     = cv2.imread(ortho_path)
    if canvas is None:
        raise RuntimeError('orthophoto.png not found — stitching must complete first.')

    ch_img, cw_img = canvas.shape[:2]
    emit(5, f'Annotating {len(trees)} trees…')

    # Group by frame index for a single sequential video pass
    frame_to_trees: dict[int, list] = {}
    for t in trees:
        if t.get('best_frame_idx', -1) >= 0:
            frame_to_trees.setdefault(t['best_frame_idx'], []).append(t)

    cap  = cv2.VideoCapture(video_path)
    done = 0

    for fi in sorted(frame_to_trees):
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ret, frame = cap.read()
        if not ret:
            continue
        fh, fw = frame.shape[:2]

        for tree in frame_to_trees[fi]:
            tid = tree['id']

            # Extract padded crop from original frame
            bbox = tree.get('bbox_frame_best')
            if bbox:
                x1f, y1f, x2f, y2f = bbox
                pad = max(4, int(max(x2f - x1f, y2f - y1f) * CROP_PAD))
                cx1 = max(0, x1f - pad);  cy1 = max(0, y1f - pad)
                cx2 = min(fw, x2f + pad); cy2 = min(fh, y2f + pad)
                crop = frame[cy1:cy2, cx1:cx2]
                if crop.size > 0:
                    cv2.imwrite(
                        os.path.join(crops_dir, f'tree_{tid:04d}.jpg'),
                        crop,
                        [cv2.IMWRITE_JPEG_QUALITY, CROP_QUALITY],
                    )

            # Draw bbox on orthomosaic using map_bbox (exact position from map detection)
            mx1 = max(0,          tree['map_bbox'][0])
            my1 = max(0,          tree['map_bbox'][1])
            mx2 = min(cw_img - 1, tree['map_bbox'][2])
            my2 = min(ch_img - 1, tree['map_bbox'][3])

            color = (34, 197, 94)
            cv2.rectangle(canvas, (mx1, my1), (mx2, my2), color, 2)

            label = str(tid)
            font  = cv2.FONT_HERSHEY_SIMPLEX
            fs    = 0.55
            (tw, th), _ = cv2.getTextSize(label, font, fs, 1)
            cv2.rectangle(canvas, (mx1, my1), (mx1 + tw + 6, my1 + th + 6), color, -1)
            cv2.putText(canvas, label, (mx1 + 3, my1 + th + 2),
                        font, fs, (8, 18, 8), 1, cv2.LINE_AA)

            done += 1
            if done % 5 == 0 or done == len(trees):
                emit(5 + int(done / len(trees) * 90),
                     f'Annotated {done}/{len(trees)}…')

    cap.release()

    out_path = os.path.join(job_dir, 'map_with_markers.png')
    cv2.imwrite(out_path, canvas)
    emit(100, f'Annotated map saved — {len(trees)} trees')


# ── main entry point ──────────────────────────────────────────────────────────

def run_frame_tree_detection(
    video_path:      str,
    trajectory_path: str,
    job_dir:         str,
    tree_model,
    conf:            float = 0.35,
    detect_step:     int   = DETECT_STEP,
    nms_iou:         float = NMS_IOU,
    centroid_merge:  float = CENTROID_MERGE,
    # kept for API compat
    merge_dist:      float = 80.0,
    progress_cb      = None,
) -> dict:

    def _emit(stage: str, pct: int, detail: str):
        if progress_cb:
            progress_cb(stage, pct, detail)

    map_path = os.path.join(job_dir, 'orthophoto.png')
    if not os.path.exists(map_path):
        raise RuntimeError('orthophoto.png not found — stitching must complete first.')

    # ── Stage 1: detect on stitched map ──────────────────────────────────────
    _emit('detect_map', 0, f'Detecting trees on orthomosaic (conf={conf}, NMS={nms_iou}, merge={centroid_merge}px)…')
    trees = _detect_on_map(
        map_path, tree_model, conf, nms_iou, centroid_merge,
        lambda pct, detail: _emit('detect_map', pct, detail),
    )

    if not trees:
        _emit('find_crops', 0, 'No trees — skipping crop search')
        _emit('find_crops', 100, 'Done')
        _emit('build_map',  0,   'No trees')
        _emit('build_map',  100, 'Done')
        tpath = os.path.join(job_dir, 'trees.json')
        with open(tpath, 'w') as f:
            json.dump({'total': 0, 'canvas_wh': _load_canvas_wh(trajectory_path),
                       'trees': []}, f)
        return {'tree_count': 0, 'trees_json': tpath,
                'markers_map': map_path, 'crops_dir': os.path.join(job_dir, 'tree_crops')}

    # ── Stage 2: find best original-frame crop per tree ───────────────────────
    _emit('find_crops', 0, f'Scanning video for best crops of {len(trees)} trees…')
    trees = _find_best_crops(
        trees, video_path, trajectory_path, detect_step,
        lambda pct, detail: _emit('find_crops', pct, detail),
    )

    # ── Stage 3: annotate map + save crops ────────────────────────────────────
    _emit('build_map', 0, f'Drawing boxes and saving crops…')
    _annotate_and_save(
        trees, job_dir, video_path,
        lambda pct, detail: _emit('build_map', pct, detail),
    )

    # Save trees.json
    canvas_wh = _load_canvas_wh(trajectory_path)
    trees_final = [
        {k: v for k, v in t.items() if k != 'bbox_frame_best'}
        for t in trees
    ]
    tpath = os.path.join(job_dir, 'trees.json')
    with open(tpath, 'w') as f:
        json.dump({
            'total':     len(trees_final),
            'canvas_wh': canvas_wh,
            'nms_iou':   nms_iou,
            'trees':     trees_final,
        }, f, indent=2)

    return {
        'tree_count': len(trees_final),
        'trees_json': tpath,
        'markers_map': os.path.join(job_dir, 'map_with_markers.png'),
        'crops_dir':   os.path.join(job_dir, 'tree_crops'),
    }


def _load_canvas_wh(trajectory_path: str) -> list:
    try:
        with open(trajectory_path) as f:
            return json.load(f).get('canvas_wh', [0, 0])
    except Exception:
        return [0, 0]
