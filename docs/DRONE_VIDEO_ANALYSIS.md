# Drone Video Analysis — Concept & Technical Documentation

## Overview

Coco-Guard's drone video analysis pipeline transforms raw drone footage of a coconut plantation into a georeferenced orthomosaic map with per-tree disease detection. A user uploads a single video file and within minutes receives an interactive, zoomable map where every coconut crown is numbered, clickable, and diagnosable — without writing a single line of code or installing any GIS software.

---

## Concept

Traditional farm inspection means walking every row, examining trees one by one — slow, inconsistent, and impractical beyond a few hundred trees. Drone-captured video solves the coverage problem but creates a new one: raw footage is a linear sequence of overlapping frames with no spatial structure.

Our system converts that unstructured video into a structured, actionable health map in three automatic stages:

1. **Stitch** — assemble overlapping drone frames into one seamless top-down orthomosaic of the entire plantation
2. **Detect** — locate every coconut tree crown in the orthomosaic using tiled YOLO instance segmentation
3. **Diagnose** — apply a leaf disease model to any selected tree crown on demand

The result is an interactive canvas where numbered markers represent individual trees. Clicking a marker triggers instant AI diagnosis — all from a single video upload.

---

## System Architecture

```
User uploads drone video (MP4 / MOV / AVI / MKV / WebM)
          │
          ▼
  POST /farm-map/start                  ← Flask ML API  :5001
  ┌───────────────────────────────┐
  │  Background thread             │
  │  run_farm_map()               │
  │   ├── _stitch()               │  Stage 1: Video → Orthomosaic
  │   └── _detect()               │  Stage 2: Orthomosaic → Tree map
  └───────────────────────────────┘
          │
          ▼
  GET /farm-map/progress/{session_id}   ← polled every 2 s by frontend
          │
          ▼  (status == "done")
  GET /farm-map/result/{session_id}     ← annotated map + tree list
          │
          ▼  on user click
  POST /farm-map/disease/{id}/{tree_id} ← per-tree, on demand
```

Three services cooperate:

| Service | Stack | Port |
|---------|-------|------|
| Frontend | React + Vite | 5173 |
| Backend | Express (Node) | 5000 |
| ML API | Flask (Python) | 5001 |

The frontend polls `/farm-map/progress` every 2 seconds. `status: "done"` is only set by the master `run_farm_map()` function **after both stages complete** and the `result` payload (annotated map, tree list) is fully written. The `/farm-map/result` endpoint returns HTTP 202 until that key is present, preventing the frontend from reading a partial result.

---

## Stage 1 — Video Stitching (Orthomosaic Generation)

**Module**: `ml/src/stitch_opencv.py`  
**Orchestrated by**: `map_pipeline._stitch()`

### What it does

The stitcher reads a drone video and builds a single seamless top-down image (orthomosaic) of the plantation — no external GIS tool, no frame extraction to disk.

### Two-pass algorithm

**Pass 1 — Trajectory estimation** (at reduced resolution, `MATCH_DIM = 1280 px`):

Every Nth frame is sampled (default `FRAME_STEP = 2`, capped at `MAX_FRAMES = 300`). Consecutive frame pairs are matched using a **6-level feature-matching cascade** that falls back to simpler methods when the primary matcher fails:

| Level | Method | Device | Notes |
|-------|--------|--------|-------|
| 1 | DISK + LightGlue | GPU | Deep learned local features; best for textured farmland |
| 2 | SuperPoint + LightGlue | GPU | Learned keypoints; robust to illumination change |
| 3 | ORB | CPU | Fast binary descriptor; good for steady flight |
| 4 | AKAZE | CPU | Nonlinear scale-space; handles larger rotations at zig-zag turns |
| 5 | LoFTR (dense matching) | GPU | Transformer; no keypoints needed; handles repetitive canopy |
| 6 | Phase correlation + velocity extrapolation | CPU | Fallback for degenerate / blurred frames |

Each successful match produces a 3×3 affine homography. These are composed cumulatively to build a **camera trajectory** — the transform from each frame's coordinate system into a shared canvas space. The trajectory is anchored to the centre frame so drift doesn't accumulate one-way.

Frames where `estimateAffinePartial2D` fails all six levels use **velocity extrapolation**: a weighted mean of the last five successful transforms (more recent = higher weight), which correctly extrapolates the drone's heading through turn segments.

**Pass 2 — Best-frame-wins blending** (at full resolution, `STITCH_DIM = 1920 px`):

Frames are re-read at full resolution, warped onto the canvas in batches of 8 (`WARP_BATCH`), and merged using **cosine-taper weighting**:

- Each frame carries a weight mask that peaks at 1.0 in the frame centre and falls smoothly to 0.0 at all four edges (a 2-D outer product of sine windows).
- When two frames cover the same canvas pixel, the pixel from whichever frame has the higher weight at that location wins.
- This eliminates seam artifacts without requiring feather blending or gradient domain compositing.

**Post-processing**:

- **Sky/glare rejection**: frames where more than 25 % of pixels are overexposed (`max > 240`) are skipped.
- **Gap fill**: any canvas pixel that received no content (black hole) is filled using `scipy.ndimage.distance_transform_edt` — O(N) nearest-neighbour propagation regardless of gap size.
- **Unsharp mask sharpening**: `output = input + 0.3 × (input − GaussianBlur(input))`, implemented via Kornia on GPU or `cv2.addWeighted` on CPU.

### CPU-only execution

The GPU (6 GB VRAM) is shared with the YOLO tree and disease models already loaded into memory. To avoid CUDA OOM errors, the stitcher is forced to run entirely on CPU by monkey-patching the module-level device variables before the call, then restoring them in a `finally` block:

```python
import gpu_warp, stitch_opencv as _stitch_mod

_cpu = torch.device('cpu')
_orig_gw_device, _orig_gw_use_gpu = gpu_warp.DEVICE, gpu_warp._USE_GPU
_orig_sc_device = _stitch_mod.DEVICE
try:
    gpu_warp.DEVICE    = _cpu
    gpu_warp._USE_GPU  = False
    _stitch_mod.DEVICE = _cpu   # makes all _disk_lg_H / _sp_lg_H / _loftr_H skip GPU
    result_path = stitch_video(video_path, out_path, 10, _cb)
finally:
    gpu_warp.DEVICE    = _orig_gw_device
    gpu_warp._USE_GPU  = _orig_gw_use_gpu
    _stitch_mod.DEVICE = _orig_sc_device
```

`stitch_opencv.DEVICE` must be patched separately from `gpu_warp.DEVICE` because each module imported the device value as its own name. With both patched, the GPU code paths (`_disk_lg_H`, `_sp_lg_H`, `_loftr_H`) auto-skip by checking `if DEVICE.type != 'cuda': return None`, falling through gracefully to ORB → AKAZE → phase correlation.

**Output**: `orthophoto.png` — a single high-resolution PNG of the full plantation footprint.

---

## Stage 2 — Tree Detection (Tiled YOLO Inference)

**Module**: `map_pipeline._detect()`  
**Model**: `coconut_tree_v6-3.pt` (YOLOv8 instance segmentation)

### Why tiled inference

A full plantation orthomosaic can exceed 10 000 × 10 000 pixels — far larger than the model's training resolution. Running the model on the full image at once would reduce individual tree crowns to just a few pixels at the inference scale, causing missed detections. Tiled inference preserves the pixel density that the model was trained at.

### Algorithm

1. The orthomosaic is divided into `1280 × 1280 px` tiles with `256 px` overlap between adjacent tiles.
2. Each tile is run through `coconut_tree_v6-3.pt` at `imgsz=1280, conf=0.35, iou=0.5`.
3. For each detection, the bounding box and segmentation mask vertices are **translated back to orthomosaic coordinates** by adding the tile's top-left offset `(tx, ty)`.
4. After all tiles are processed, **global Non-Maximum Suppression** (IoU threshold 0.4) deduplicates trees that appear in two overlapping tiles.

### Per-tree outputs

For each surviving detection (sorted by detection order, numbered `#1, #2, …`):

- Bounding box `(x1, y1, x2, y2)` in orthomosaic pixels
- Centre point `(cx_px, cy_px)` — used for interactive map markers
- A padded crop of the orthomosaic, saved as `tree_NNNN.jpg` with `CROP_PAD = 24 px` margin — used later for disease analysis

The annotated orthomosaic (`detected_trees.png`) is drawn with green polygon outlines (where instance masks are available) or bounding rectangles (fallback), plus a numbered badge at each tree centre. This is the image shown in the interactive map viewer.

**Outputs per session**:

| File | Contents |
|------|----------|
| `detected_trees.png` | Annotated orthomosaic shown to the user |
| `trees.json` | Array of tree objects (coordinates, confidence, crop filename, disease — initially null) |
| `tree_detections.csv` | Tabular export of all detections |
| `tree_NNNN.jpg` | Individual padded crop for each tree |
| `trajectory.json` | Camera trajectory (frame indices + transforms + canvas size) |

---

## Stage 3 — Disease Analysis (Per-Tree, On Demand)

**Module**: `map_pipeline.analyze_tree_disease()`  
**Endpoint**: `POST /farm-map/disease/{session_id}/{tree_id}`  
**Model**: `coconut_disease_v5.pt` (YOLOv8 instance segmentation, same model used by the Image Upload tab)

### Why on-demand, not automatic

Running the disease model on all trees automatically would add O(tree_count) YOLO inference calls to the pipeline — typically 30–150 calls for a normal field. Most users only need to inspect a subset of trees. By making diagnosis on-demand (user clicks a numbered marker, then presses "Analyse Disease"), the system stays fast for browsing while keeping full diagnostic power available.

### Disease classes

The model was trained on coconut leaf imagery and distinguishes four conditions:

| Class ID | Disease | Marker colour |
|----------|---------|---------------|
| 0 | Black Beetle Attack | Red `#dc2626` |
| 1 | Magnesium Deficiency | Orange `#ea580c` |
| 2 | Potassium Deficiency | Amber `#d97706` |
| 3 | Yellow Patches | Yellow `#ca8a04` |
| — | Healthy (no detection) | Green `#16a34a` |

If the model produces no detections above the confidence threshold (0.20), the tree is classified as **Healthy** with confidence 1.0.

### Annotation style

Both the farm map disease endpoint and the image upload `/predict` endpoint use the same `_plot_clean()` function. It draws clean, readable overlays without any text on the image:

- **Segmentation masks** (when available): 28 % opacity coloured fill via `cv2.addWeighted`, plus a 2 px solid border via `cv2.polylines`
- **Bounding boxes** (fallback): 25 % opacity fill via `cv2.rectangle + addWeighted`, plus a 2 px border
- No text, no confidence numbers, no class labels drawn on the image itself — all that information appears in the UI below the image

Colours are consistent between the backend (OpenCV BGR) and the frontend (Tailwind / CSS hex), so the annotation colour on the image always matches the disease badge colour in the side panel.

### Result persistence

The disease result is written back to `trees.json` immediately after analysis. Re-clicking a previously analysed tree returns the cached result without re-running inference.

### API response

```json
{
  "success": true,
  "tree_id": 7,
  "disease": "Potassium Deficiency",
  "disease_confidence": 0.871,
  "crop_image": "data:image/jpeg;base64,…",
  "all_detections": [
    { "disease": "Potassium Deficiency", "confidence": 0.871 },
    { "disease": "Black Beetle Attack",  "confidence": 0.412 }
  ]
}
```

`crop_image` is a base64-encoded JPEG of the tree crop with clean semi-transparent disease annotations.

---

## Frontend — Interactive Map Viewer

**Component**: `MapViewer` in `frontend/src/pages/FarmMapAnalysis.jsx`

The map is rendered on an HTML5 `<canvas>` element, not a DOM image, to enable performant pan/zoom/draw over a potentially large orthomosaic.

### Controls

| Action | Gesture |
|--------|---------|
| Pan | Click and drag |
| Zoom | Scroll wheel (non-passive event listener prevents page scroll) |
| Select tree | Click within 18 px of any tree marker centre |
| Reset view | "Fit view" button (top-right toolbar) |

### Transform state

The canvas transform `{x, y, scale}` is stored in both React state (to trigger redraws) and a `useRef` (so mouse event handlers always see the current value without stale closure issues). A `ResizeObserver` keeps the canvas sized to its container without layout shifts.

### Tree markers

Each tree in `trees.json` gets a numbered circle marker drawn at `(cx_px, cy_px)` in orthomosaic coordinates, transformed to canvas coordinates by the current pan/zoom. Marker colour follows `DISEASE_PALETTE`:

- **Green** — unanalysed or confirmed healthy
- **Red / Orange / Amber / Yellow** — specific disease (matching the backend annotation colours exactly)

The selected tree gets an outer glow ring and an inverted fill (white circle, coloured number) to stand out clearly at any zoom level.

### Side panel

A `280 px` right panel shows:

- **Farm Health ring**: SVG arc showing the percentage of trees confirmed healthy
- **Stat cards**: Healthy / At Risk / Unanalysed counts
- **Selected tree card**: detection confidence bar, "Analyse Disease" button, disease result crop, confidence bar, all-detections list, re-analyse button
- **Marker legend**: colour key for all five states

---

## Job State Machine

```
initial state: { status: 'queued' }
         │
         ▼  run_farm_map() starts
{ status: 'running', stage: 'stitch', progress: 2–98 }
         │  _stitch() completes
         ▼
{ status: 'running', stage: 'detect', progress: 0 }
         │  _detect() scanning tiles...
         ▼
{ status: 'running', stage: 'detect', progress: 1–100 }
         │  _detect() completes; run_farm_map() writes result
         ▼
{ status: 'done', stage: 'complete', result: { map_b64, tree_count, trees_path, annotated_path } }

On any exception:
{ status: 'error', error: '...', traceback: '...' }
```

`status: "done"` is only ever set by `run_farm_map()` after **both** stages have completed and the `result` dict is fully populated. Individual stage completions keep `status: "running"` so the frontend cannot fetch a partial result. The `/farm-map/result` endpoint guards against this explicitly:

```python
if job.get("status") != "done" or "result" not in job:
    return jsonify({"status": job.get("status"), ...}), 202
```

---

## Model Files

| File | Purpose | Architecture |
|------|---------|-------------|
| `ml/weights/coconut_tree_v6-3.pt` | Tree crown detection + instance segmentation | YOLOv8-seg |
| `ml/weights/coconut_disease_v5.pt` | Leaf disease detection + instance segmentation | YOLOv8-seg |

`coconut_disease_v5.pt` is the same weight file as `ml/weights/disease_v5/weights/best.pt` (identical byte size: 45,239,338 bytes). The `disease_v5` folder is the training run output; `coconut_disease_v5.pt` is the deployed copy. Both models are loaded lazily and cached in module-level globals with a `threading.Lock` to prevent double-initialisation under concurrent requests.

**Training details for disease_v5**:
- Architecture: YOLOv8-seg
- Epochs: 130
- Optimiser: AdamW
- Image size: 1280 px
- Data: `C:\ML_Data\combined\data.yaml`

---

## Data Flow Summary

```
drone_video.mp4
    │
    ▼  _stitch()  — CPU, ~3–8 min depending on video length
orthophoto.png          ← full plantation top-down mosaic
    │
    ▼  _detect()  — GPU YOLO tiled inference, ~1–2 min
detected_trees.png      ← annotated map shown in the canvas viewer
trees.json              ← tree list driving the map markers
tree_NNNN.jpg           ← per-tree canopy crops (stored, not displayed until selected)
    │
    ▼  on user click → analyze_tree_disease()
crop_annotated.jpg      ← clean semi-transparent disease annotation
disease result          ← written back to trees.json (cached for re-clicks)
```

---

## Limitations and Known Constraints

- **Stitching quality depends on flight overlap**: videos with less than ~60 % frame overlap between consecutive frames will produce gaps in the orthomosaic that gap-fill alone cannot fully recover.
- **CPU stitching is slow**: the stitcher runs on CPU to avoid competing with YOLO for VRAM. A 1–2 minute drone video typically takes 3–8 minutes to stitch on CPU.
- **Canvas size cap**: the orthomosaic is capped at `MAX_PX = 12 000 px` on the longest dimension to prevent out-of-memory crashes on very large plantations. The canvas is downscaled uniformly if it would exceed this.
- **Disease model trained on leaf images**: the per-tree crop from an overhead drone is a top-down canopy view, which differs from the leaf-level imagery the disease model was trained on. Results are indicative rather than clinical, and confidence thresholds are set conservatively (0.20) to increase recall.
- **Single-GPU constraint**: the tree model, disease model, and (if GPU were used) stitcher must share 6 GB VRAM. Currently the stitcher is forced to CPU to ensure the YOLO models always have full GPU access.
