# Frame-Based Tree Detection & Pre-computed Disease Analysis — Implementation Plan

## Problem Statement

The current pipeline runs YOLO tree detection on the **stitched orthomosaic**. The orthomosaic has stitching artifacts — blurred seams, ghosting from overlapping frames, misaligned patches — because the stitcher blends up to 300 frames into one image with weighted averaging. Running a detection model on a blended/glitchy image produces:

- Missed trees at seam boundaries
- Degraded bounding boxes due to blur
- Low-quality crops passed to the disease model (tree looks smeared)
- Disease results that are unreliable for the user

**The fix**: detect trees from the **individual video frames** that were used to build the orthomosaic. Each frame is a clean, sharp, unblended image. Use the transform data already saved in `trajectory.json` to project all frame-detected trees into orthomosaic coordinate space, deduplicate them (since every tree appears in several consecutive frames), and run disease analysis on the best-quality crop of each unique tree **before** the pipeline finishes. The orthomosaic map is kept purely as the interactive background; all detections and disease results come from clean frames.

---

## New Pipeline Overview

```
Video upload
    │
    ▼  Stage 1: _stitch()          ← unchanged
orthophoto.png
trajectory.json  ← transforms: frame coords → canvas coords (already saved)
    │
    ▼  Stage 2: _detect_from_frames()   ← replaces _detect()
    │   ├─ Pass A: stream video → YOLO on each sampled frame
    │   ├─ Pass B: project all detections to canvas space via trajectory.json
    │   ├─ Pass C: centroid-distance NMS → unique trees
    │   ├─ Pass D: score each cluster → pick best-quality frame per tree
    │   └─ Pass E: seek to best frames → crop → run disease model → annotate
    │
    ▼
detected_trees.png  ← orthomosaic with coloured numbered markers (disease-coloured)
trees.json          ← all trees with pre-computed disease + annotated crop (base64)
    │
    ▼  Frontend (no waiting for disease)
Interactive map — click any tree → disease result shown INSTANTLY (no "Analyse" button)
```

The `/farm-map/disease` endpoint is kept for re-analysis only (if the user wants a fresh run on an already-diagnosed tree).

---

## Stage-by-Stage Algorithm

### Stage 1 — Stitching (Unchanged)

`map_pipeline._stitch()` runs as-is. The key output for this plan is `trajectory.json`, which the stitcher already writes:

```json
{
  "frame_indices":  [0, 2, 4, 6, …],     ← actual video frame numbers sampled
  "transforms":     [ [[…],[…],[…]], … ], ← one 3×3 matrix per frame
  "canvas_wh":      [cw, ch],
  "orig_frame_wh":  [fw_orig, fh_orig]
}
```

`transforms[i]` is the composed matrix `T_off @ T_list[i] @ T_down` that maps a point `(px, py)` in the original video frame `frame_indices[i]` to canvas pixel coordinates:

```python
pt_h   = np.array([px, py, 1.0], dtype=np.float64)
canvas = transforms[i] @ pt_h          # homogeneous
cx     = canvas[0] / canvas[2]
cy     = canvas[1] / canvas[2]
```

No changes to `stitch_opencv.py`.

---

### Stage 2 — Frame-Based Detection (`_detect_from_frames`)

This function replaces `_detect()` entirely. It has five internal passes.

#### Pass A — Per-Frame YOLO Detection (single video stream)

```
Open video with cv2.VideoCapture(video_path)
Load trajectory.json → frame_indices, transforms, orig_frame_wh

raw_detections = []

Stream video sequentially:
  frame_counter = 0
  traj_idx      = 0

  while traj_idx < len(frame_indices):
      ret, frame = cap.read()
      if not ret: break

      if frame_counter == frame_indices[traj_idx]:
          # Run tree model at native frame resolution
          results = tree_model.predict(frame, imgsz=1280, conf=0.35, iou=0.5)
          r = results[0]

          if r.boxes is not None:
              for j, box in enumerate(r.boxes):
                  x1, y1, x2, y2 = box.xyxy[0].tolist()
                  conf = float(box.conf[0])

                  # Store frame-space bbox + traj index
                  raw_detections.append({
                      'traj_idx':   traj_idx,          # index into trajectory.json
                      'frame_fno':  frame_indices[traj_idx],  # actual video frame number
                      'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                      'conf': conf,
                      'mask_pts': r.masks.xy[j].tolist() if r.masks else None,
                  })

          traj_idx += 1

      frame_counter += 1

cap.release()
```

**Why stream sequentially instead of seeking?** The frame indices are already evenly spaced (every `FRAME_STEP`-th frame). Sequential reading is faster than repeated `cap.set(CAP_PROP_POS_FRAMES, ...)` seeks on most codecs. Pass E will use seeking because it reads only N_trees frames (usually << N_frames).

Progress updates: every 10 frames processed → `_update(session_id, 'detect', int(traj_idx / N * 60), f'Detecting trees in frame {traj_idx}/{N}…')`

---

#### Pass B — Project to Canvas Space

For each raw detection, project the bounding box centroid and corners to orthomosaic (canvas) coordinates:

```python
def _project_to_canvas(det, transform):
    """Project frame-space bbox to canvas centroid + approximate canvas bbox."""
    T = np.array(transform, dtype=np.float64)   # 3×3

    # Project all 4 corners + centroid
    points_frame = np.array([
        [(det['x1'] + det['x2']) / 2, (det['y1'] + det['y2']) / 2],  # centre
        [det['x1'], det['y1']],
        [det['x2'], det['y1']],
        [det['x2'], det['y2']],
        [det['x1'], det['y2']],
    ], dtype=np.float64)

    pts_h = np.hstack([points_frame, np.ones((5, 1))])   # homogeneous
    projected = (T @ pts_h.T).T
    projected /= projected[:, 2:3]                        # normalise

    cx, cy = projected[0, 0], projected[0, 1]
    canvas_pts = projected[1:, :2]
    cx1, cy1 = canvas_pts[:, 0].min(), canvas_pts[:, 1].min()
    cx2, cy2 = canvas_pts[:, 0].max(), canvas_pts[:, 1].max()

    return cx, cy, cx1, cy1, cx2, cy2
```

Add these canvas coordinates to each detection dict.

---

#### Pass C — Centroid-Distance NMS (Deduplication)

IoU-based NMS is unreliable here because the same tree seen from two different drone positions gets projected to slightly different canvas shapes (parallax). Centroid-distance clustering is more robust:

```
MERGE_RADIUS = 60   ← canvas pixels; a tree crown ≈ 2–3 m,
                       canvas ≈ 12 000 px / plantation width

Sort raw_detections by conf descending

unique_trees  = []      ← list of clusters (each cluster = list of detections)
suppressed    = [False] × len(raw_detections)

for i, det_i in enumerate(sorted_dets):
    if suppressed[i]: continue

    cluster = [det_i]
    for j, det_j in enumerate(sorted_dets[i+1:], start=i+1):
        if suppressed[j]: continue
        dist = sqrt((det_i.canvas_cx − det_j.canvas_cx)²
                  + (det_i.canvas_cy − det_j.canvas_cy)²)
        if dist < MERGE_RADIUS:
            cluster.append(det_j)
            suppressed[j] = True

    unique_trees.append(cluster)
    suppressed[i] = True
```

Result: `unique_trees` is a list of clusters. Each cluster represents one physical coconut tree. All raw detections within the cluster are the same tree seen from different frames.

**MERGE_RADIUS calibration note**: 60 canvas pixels is a starting value. If the canvas is `~10 000 px` wide and the plantation is `~100 m` wide, that is `60 / 100 × 100 m = 0.6 m` — tighter than a crown radius (`~1.5 m`), which is intentional to avoid merging adjacent trees. Expose it as a constant `MERGE_RADIUS = 60` at the top of the new function so it can be tuned.

---

#### Pass D — Best-Frame Scoring

For each cluster, score every member detection and pick the one where the tree appears most cleanly — nearest to the frame centre (least lens distortion, best lighting from overhead):

```python
FRAME_W, FRAME_H = orig_frame_wh   # from trajectory.json
half_diag = sqrt((FRAME_W/2)**2 + (FRAME_H/2)**2)

def _score(det):
    # Centre of bbox in frame space
    bx = (det['x1'] + det['x2']) / 2
    by = (det['y1'] + det['y2']) / 2
    # Distance from frame centre
    dist = sqrt((bx - FRAME_W/2)**2 + (by - FRAME_H/2)**2)
    center_weight = 1.0 - dist / half_diag
    return det['conf'] * center_weight

best_det = max(cluster, key=_score)
```

The winner `best_det` holds:
- `traj_idx` → which trajectory transform to use for canvas position
- `frame_fno` → which video frame to seek to for the crop
- `x1, y1, x2, y2` → bbox in frame coordinates for the crop

Canvas position of this tree: `(best_det.canvas_cx, best_det.canvas_cy)`.

---

#### Pass E — Batch Disease Pre-Analysis (seeking re-read)

Group all unique trees by `frame_fno` so each video frame is decoded **at most once**:

```
frame_to_trees = defaultdict(list)
for tree_record in unique_trees_with_best:
    frame_to_trees[best_det.frame_fno].append(tree_record)

Open video again with cv2.VideoCapture(video_path)

for frame_fno, tree_list in sorted(frame_to_trees.items()):
    cap.set(CAP_PROP_POS_FRAMES, frame_fno)
    ret, frame = cap.read()
    if not ret: continue

    for tree_record in tree_list:
        x1, y1, x2, y2 = tree_record.best_det bbox (int, clamped to frame size)
        # Add CROP_PAD
        cx1 = max(0, x1 - CROP_PAD)
        cy1 = max(0, y1 - CROP_PAD)
        cx2 = min(FRAME_W, x2 + CROP_PAD)
        cy2 = min(FRAME_H, y2 + CROP_PAD)

        crop = frame[cy1:cy2, cx1:cx2]   ← clean, sharp, unblended frame crop

        # Save raw crop for re-analysis later
        crop_name = f'tree_{tree_record.tree_id:04d}.jpg'
        cv2.imwrite(crop_path, crop, [IMWRITE_JPEG_QUALITY, 90])

        # Run disease model
        disease_results = disease_model.predict(crop, conf=0.20)
        annotated_crop  = _plot_clean(crop.copy(), disease_results[0])

        # Encode
        _, buf = cv2.imencode('.jpg', annotated_crop, [IMWRITE_JPEG_QUALITY, 88])
        crop_b64 = 'data:image/jpeg;base64,' + b64encode(buf).decode()

        # Persist to tree record
        tree_record.update({
            'disease':            disease_label,
            'disease_confidence': disease_conf,
            'all_detections':     detections_list,
            'crop_image':         crop_b64,     ← pre-computed, not on-demand
        })

    # Progress
    _update(session_id, 'disease', int(processed / total * 100),
            f'Disease analysis {processed}/{total} trees…')

cap.release()
```

Progress stage name `'disease'` needs a corresponding entry in the frontend's `STAGES` array (see Frontend Changes below).

---

#### Pass F — Map Annotation

Draw numbered markers on the orthomosaic. Colour each marker by the **pre-computed disease** (not green-for-all-unanalysed):

```python
out = map_np.copy()

for tree in trees:
    cx, cy = tree['cx_px'], tree['cy_px']
    color  = DISEASE_COLORS_BGR.get(tree['disease'], (0, 200, 100))

    # Draw segment outline at canvas position if mask available (optional — low priority)
    cv2.circle(out, (cx, cy), 14, color, -1)
    cv2.circle(out, (cx, cy), 14, (255, 255, 255), 2)

    label = f'#{tree["tree_id"]}'
    …  # badge text (same as current _detect())

cv2.imwrite(annotated_path, out)
```

---

## Key Constants

| Constant | Value | Location | Notes |
|----------|-------|----------|-------|
| `MERGE_RADIUS` | 60 | `map_pipeline._detect_from_frames` | Canvas px; tune based on typical crown size at your canvas scale |
| `TREE_CONF` | 0.35 | same | YOLO confidence threshold for tree model |
| `DISEASE_CONF` | 0.20 | same | YOLO confidence for disease model (low = high recall) |
| `CROP_PAD` | 24 | `map_pipeline` (already exists) | Pixels added around bbox before cropping |
| `FRAME_STEP` | 2 | `stitch_opencv` (already exists) | Already used for trajectory; same indices reused |

---

## Changes by File

### `ml/src/map_pipeline.py` — Major

| Change | Detail |
|--------|--------|
| **Add** `_detect_from_frames(session_id, video_path, job_dir, conf)` | Replaces `_detect()`. Implements Passes A–F above. Returns `(annotated_path, trees_path, tree_count)` — same return signature as `_detect()`. |
| **Remove or keep** `_detect()` | Can keep it as `_detect_ortho()` (fallback for if trajectory.json is missing), or delete it. |
| **Modify** `run_farm_map()` | Replace `_detect(session_id, map_path, job_dir, conf)` with `_detect_from_frames(session_id, video_path, job_dir, conf)`. Note: `video_path` is deleted in the `finally` block — the call to `_detect_from_frames` must happen **before** the `finally`. Move the delete-video logic: do NOT delete video until after `_detect_from_frames` finishes. |
| **Modify** `analyze_tree_disease()` | Since disease is pre-computed, this function now just loads `trees.json`, finds the tree, and returns the cached `crop_image` + disease fields. If `crop_image` is empty (shouldn't happen normally), it falls back to re-running the disease model on `tree_NNNN.jpg`. |
| **Add** stage `'disease'` to progress updates | `_update(session_id, 'disease', pct, detail)` inside Pass E. |
| **Add** `_DISEASE_COLORS_BGR_HEALTHY` | Green for healthy/unanalysed in the map annotation. |

**Critical**: `video_path` is currently deleted in `run_farm_map()`'s `finally` block. With the new approach, `_detect_from_frames` needs to re-read the video. The `finally` block must only delete the video **after** `_detect_from_frames` returns. The current structure already ensures this since the `finally` runs after the `try` block completes — no change needed in `run_farm_map()` structure, but verify the flow.

### `ml/src/app.py` — Minor

| Change | Detail |
|--------|--------|
| **Update** `farm_map_disease` endpoint | Since disease is pre-computed, the endpoint now calls `analyze_tree_disease()` which returns the cached result. If `crop_image` is present in the cached result, return it directly. Keep the endpoint for explicit re-analysis. |
| **No other changes needed** | The `/farm-map/result` response already reads `trees.json` and returns the `trees` array — the frontend will now see `disease`, `disease_confidence`, `all_detections`, and `crop_image` already populated. |

### `frontend/src/pages/FarmMapAnalysis.jsx` — Moderate

#### 1. Add `'disease'` to the `STAGES` array

```js
const STAGES = [
  { key: 'stitch',  label: 'Stitching Frames',        icon: '🛸', desc: 'Aligning drone footage into orthomosaic' },
  { key: 'detect',  label: 'Detecting Trees',          icon: '🌴', desc: 'Running YOLO on video frames' },
  { key: 'disease', label: 'Analysing Disease',        icon: '🔬', desc: 'Pre-computing disease for all trees' },
];
```

Update `StageStepper`:
```js
const STAGE_MAP = { stitch: 1, detect: 2, disease: 3, complete: 4 };
```

#### 2. Auto-populate disease result when a tree is selected

When `selectedTree` changes and it already has a disease result (from pre-computed `trees.json`), set `diseaseResult` immediately without waiting for a button press:

```js
useEffect(() => {
  if (!selectedTree) { setDiseaseResult(null); return; }
  if (selectedTree.crop_image && selectedTree.disease) {
    // Pre-computed — show immediately
    setDiseaseResult({
      tree_id:             selectedTree.tree_id,
      crop_image:          selectedTree.crop_image,
      disease:             selectedTree.disease,
      disease_confidence:  selectedTree.disease_confidence,
      all_detections:      selectedTree.all_detections || [],
    });
  } else {
    setDiseaseResult(null);
  }
}, [selectedTree]);
```

#### 3. Change "Analyse Disease" button to "Re-analyse"

The button only shows when `diseaseResult` is already set (for re-analysis). Since disease is pre-computed, the initial view has no loading state:

```jsx
{/* Show 'Re-analyse' only when result is already displayed */}
{diseaseResult && (
  <button onClick={() => { setDiseaseResult(null); handleAnalyseDisease(); }}
    className="…">
    <RefreshCw size={12} /> Re-analyse
  </button>
)}
```

Remove the `{!diseaseResult && <button …Analyse Disease…>}` block (or keep it and let it be the fallback if `crop_image` is missing).

#### 4. Map marker colouring

No change needed. The canvas draw loop already reads `tree.disease` to colour markers — since disease is now pre-populated in `trees`, all markers arrive already coloured correctly when the result loads.

### `frontend/src/services/farmMapService.js` — No changes needed

`analyseTreeDisease` is still used for the Re-analyse flow. No changes.

---

## Updated `trees.json` Schema

**Before (current):**
```json
[
  {
    "tree_id": 1,
    "cx_px": 420, "cy_px": 318,
    "x1": 380, "y1": 280, "x2": 460, "y2": 356,
    "confidence": 0.8821,
    "crop_file": "tree_0001.jpg",
    "disease": null,
    "disease_confidence": null,
    "all_detections": []
  }
]
```

**After (new):**
```json
[
  {
    "tree_id": 1,
    "cx_px": 420, "cy_px": 318,
    "x1_canvas": 380, "y1_canvas": 280, "x2_canvas": 460, "y2_canvas": 356,
    "frame_fno": 84,
    "x1_frame": 612, "y1_frame": 390, "x2_frame": 780, "y2_frame": 520,
    "confidence": 0.8821,
    "crop_file": "tree_0001.jpg",
    "disease": "Potassium Deficiency",
    "disease_confidence": 0.871,
    "all_detections": [
      { "disease": "Potassium Deficiency", "confidence": 0.871 },
      { "disease": "Black Beetle Attack",  "confidence": 0.312 }
    ],
    "crop_image": "data:image/jpeg;base64,…"
  }
]
```

New fields:
- `cx_px`, `cy_px` — canvas centroid (unchanged name, new source: projected from frame)
- `x1_canvas … y2_canvas` — projected canvas bbox (replaces old `x1…y2` which were canvas coords from tiled detection)
- `frame_fno` — video frame number of the best detection (for re-analysis)
- `x1_frame … y2_frame` — bbox in original frame coordinates (for re-cropping)
- `crop_image` — base64 JPEG of annotated crop (pre-computed; was empty before)
- `disease`, `disease_confidence`, `all_detections` — now pre-populated (were null/empty before)

---

## Updated Progress / State Machine

```
{ status: 'queued' }
    │
    ▼  _stitch() starts
{ status: 'running', stage: 'stitch', progress: 2–98 }
    │  _stitch() done
    ▼
{ status: 'running', stage: 'detect', progress: 0–60 }
    │  Frame detection + projection + deduplication
    ▼
{ status: 'running', stage: 'disease', progress: 0–100 }
    │  Per-tree disease pre-analysis
    ▼
{ status: 'done', stage: 'complete', result: { map_b64, tree_count, trees_path, annotated_path } }
```

Frontend now has 3 stages: stitch → detect → disease.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| `trajectory.json` missing (stitch failed silently) | `_detect_from_frames` raises `RuntimeError('trajectory.json not found')` → caught by `run_farm_map()` `except` block → sets `status: error` |
| Frame cannot be decoded (`cap.read()` returns `False`) | Skip that frame; tree gets `crop_image = ''`, disease defaults to `'Healthy'` (same as no detection) |
| Two adjacent trees within `MERGE_RADIUS` | They merge into one. If this is a problem, lower `MERGE_RADIUS` to `40` px. Expose the constant in `settings` dict passed from frontend so it is user-adjustable later. |
| Tree visible in only 1 frame | Cluster has 1 member → it is the best frame by default. No special case needed. |
| Tree at frame edge (partially cut off) | `best_det` scoring penalises off-centre detections, so this detection will lose to an on-centre one if available. If it's the only detection, `_score` will still be positive (confidence > 0). Crop is clamped to frame bounds by `max(0, x1 - PAD)`. |
| Disease model finds nothing in crop | `disease = 'Healthy'`, `disease_confidence = 1.0`, `all_detections = []` — same logic as `analyze_tree_disease()` today. |
| Very long video (> 300 sampled frames cap) | `MAX_FRAMES = 300` cap already applies in `stitch_opencv.stitch_video`. `trajectory.json` only saves the frames actually used (≤ 300). `_detect_from_frames` uses the same list → at most 300 YOLO calls. |
| GPU OOM during disease batch | `_get_disease_model()` uses the same lazy-load + lock as today. If OOM occurs, the error is caught per-tree and the tree is marked as failed; the pipeline continues. |

---

## Estimated Timing Impact

| Stage | Current | New |
|-------|---------|-----|
| Stitching | ~3–8 min | unchanged |
| Tree detection | ~1–2 min (tiled ortho) | ~2–4 min (per-frame YOLO on ≤300 frames at 1280px) |
| Disease analysis | on-demand (~2 s / tree) | pre-computed: ~1 s/tree × N_trees |

For a 50-tree plantation: disease pre-computation adds ~50 s to the pipeline but eliminates all per-click wait times in the frontend. For a 200-tree plantation add ~3–4 min. This is acceptable because the user waits once and then the map is instantly fully interactive.

---

## Implementation Order (no wasted work, no duplication)

1. **`map_pipeline.py`** — write `_detect_from_frames()` with all 5 passes. Add `'disease'` as a valid stage name in `_update()` calls. Adjust `run_farm_map()` to not delete the video until after `_detect_from_frames` returns.
2. **`map_pipeline.py`** — update `analyze_tree_disease()` to return cached result from `trees.json` if `crop_image` is present; fall back to live re-run if not.
3. **`frontend/src/pages/FarmMapAnalysis.jsx`** — add `'disease'` to `STAGES`, update `StageStepper`, add the `useEffect` that auto-populates disease from `selectedTree`, replace "Analyse Disease" button with "Re-analyse".
4. **`app.py`** — no changes required (endpoint already returns full `trees.json`; disease is simply already populated).
5. **Test** with a short video (~30 s), check:
   - `trajectory.json` is generated
   - `_detect_from_frames` reads it correctly
   - Canvas markers appear at correct positions over the orthomosaic
   - Clicking a tree shows the pre-computed disease result instantly
   - Disease colours match markers
