# Farm Map Analysis — Speed Improvement Plan

Current wall-clock on a DJI 65-second clip (RTX 3060 6 GB): ~8–12 min total.  
Breakdown: stitching ≈70%, tree detection ≈15%, disease analysis ≈15%.

---

## 1. Stitching (biggest win — 70% of time)

### 1a. Reduce keyframe count (easy, ~30% faster stitch)
`stitch_video` currently samples 1 frame every 10 frames by default.  
Change the `sample_rate` argument from 10 to 15–20.  The homography accuracy barely
changes because DJI videos move slowly, but the feature-matching graph shrinks
roughly O(n²) so fewer frames gives disproportionate speedup.

**File:** `ml/src/app.py` → `stitch_video(video_path, out_path, sample_rate=10, …)`  
**Change:** increase `sample_rate` to `15` (configurable via `config.yaml` key `stitch_sample_rate`).

### 1b. Cap orthomosaic resolution (easy, ~20% faster stitch + faster I/O)
Very large orthomosaics (>6000 px wide) slow down stitching, image blending, and
all downstream steps.  Add a `max_ortho_px` cap (e.g. 5000) and resize after stitching.

**File:** `ml/src/map_pipeline.py` `_stitch()` — resize `img` after `stitch_video` returns:
```python
MAX_ORTHO = int(_cfg.get('max_ortho_px', 5000))
img = cv2.imread(out_path)
h, w = img.shape[:2]
if max(h, w) > MAX_ORTHO:
    scale = MAX_ORTHO / max(h, w)
    img = cv2.resize(img, (int(w*scale), int(h*scale)), cv2.INTER_AREA)
    cv2.imwrite(out_path, img)
```

### 1c. GPU stitching (medium effort, 2–3× faster stitch)
`stitch_opencv.py` forces CPU mode when sharing the GPU with YOLO.  The simplest fix
is to run stitching **first** (before any YOLO model is loaded), then unload the
stitcher weights and call `torch.cuda.empty_cache()` before loading YOLO.

The current code already does this sequentially — the key change is to not pre-load
`_get_tree_model()` globally at startup, but instead load it lazily *after* `_stitch()`
returns.  This means the GPU is free during stitching and can be used by the stitcher
(LightGlue/LoFTR feature matchers).

**Estimated impact:** stitch phase cut from ~6 min to ~2 min.

### 1d. Sparse frame sampling in trajectory builder (easy, ~15% faster stitch)
The trajectory builder currently stores every Nth frame.  Switch to a **keyframe-only
strategy**: skip frames where the camera hasn't moved enough (compare consecutive
homography translations, skip if `|Δt| < 5 px`).  This naturally prunes hovering
footage and fast-moving segments that add noise.

---

## 2. Tree Detection (15% of time)

### 2a. Smaller imgsz by default (easy, ~40% faster inference, minor accuracy drop)
The tree model runs at `imgsz=1280`.  Most DJI coconut footage has crowns that are
50–200 px wide; `imgsz=960` is sufficient and significantly faster.

**File:** `ml/src/config.yaml`
```yaml
imgsz_tree: 960        # was 1280
```
**File:** `ml/src/map_pipeline.py` — replace hard-coded `imgsz=1280` with
`IMGSZ_TREE = int(_cfg.get('imgsz_tree', 1280))`.

### 2b. FP16 half-precision inference (easy, ~25% faster, no accuracy change)
On any GPU with Tensor Cores (RTX series), FP16 halves memory usage and speeds up
inference ~25%.

**Change in `_predict_safe`:**
```python
kwargs.setdefault('half', True)   # add this line before the predict call
```

### 2c. Batch frame inference (medium effort, ~50% faster tree detection)
Currently tree detection runs one frame at a time.  YOLO supports batch inference.
Collect frames that need processing into lists of 8–16, pass them as a list to
`model.predict(source=[frame1, frame2, …], …)`.

**Rough implementation:**
```python
BATCH = 8
pending_frames, pending_indices = [], []
for traj_idx in range(N):
    …collect frame…
    pending_frames.append(frame)
    pending_indices.append(traj_idx)
    if len(pending_frames) == BATCH or traj_idx == N - 1:
        batch_results = _predict_safe(tree_model, pending_frames, …)
        # distribute results back to pending_indices
        pending_frames, pending_indices = [], []
```

---

## 3. Disease Analysis (15% of time)

### 3a. Parallel crop inference (easy, ~3× faster disease phase)
Disease crops are independent — they can run in parallel.  The `EXECUTOR`
`ThreadPoolExecutor` already exists.  Use it:

```python
from concurrent.futures import as_completed

def _analyse_crop(args):
    crop, tree = args
    # run disease_model.predict on crop, return (disease, conf, detections, b64)
    …

futures = {EXECUTOR.submit(_analyse_crop, (crop, tree)): tree for …}
for future in as_completed(futures):
    tree = futures[future]
    disease, conf, detections, b64 = future.result()
    tree.update(…)
```

Note: YOLO is not thread-safe on GPU — use `torch.multiprocessing` or run disease
inference in a single thread but pipeline the I/O (crop extraction + encoding) in
parallel with inference.

### 3b. FP16 for disease model too (same as 2b, free win)
Same `half=True` in `_predict_safe`.

### 3c. Skip disease pre-analysis, run on-demand only (trade-off)
Disease analysis currently runs for **every** tree during map creation.  If the user
clicks a specific tree on the map the result is immediate.  Alternative: skip the
pre-analysis pass and only run disease on trees the user clicks.  Cuts the total
pipeline time by ~15% at the cost of per-click latency (~0.3 s each).

**When to use:** for large videos (>200 trees) where pre-analysis takes several minutes.

---

## 4. Quick Infrastructure Wins

| Change | File | Effort | Impact |
|---|---|---|---|
| JPEG not PNG for orthomosaic | `_stitch()` save as `.jpg` quality 90 | 5 min | Faster I/O, smaller job dir |
| Reduce JPEG quality for map_b64 | `IMWRITE_JPEG_QUALITY 82→70` | 2 min | Smaller base64 payload |
| Skip-frame early if no movement | trajectory builder | 1 hr | ~10% fewer frames |
| `torch.no_grad()` everywhere | wrap all predict calls | 15 min | Marginal GPU memory saving |
| Limit to 1 concurrent farm-map job | `EXECUTOR max_workers=1` | already done | Prevents OOM from parallel jobs |

---

## 5. Recommended Priority Order

1. **1c GPU stitching** (lazy model loading) — biggest single win, ~40% total time saved
2. **2b + 3b FP16** — two-line change, ~20% inference speedup
3. **1a Higher sample_rate** — one config change, ~15% stitch speedup
4. **2a imgsz=960** — one config change, ~10% detection speedup
5. **1b ortho resolution cap** — simple post-process, reduces all downstream work
6. **2c batch inference** — more effort, 15% detection speedup
7. **3a parallel disease analysis** — medium effort, 10% total speedup

With changes 1–5 the expected total time drops from ~10 min to **~4 min** on the
same hardware for a 65-second DJI clip.
