# Training Log — `coconut_tree_v6-3.pt`
> Coconut Tree Detection · YOLOv8 Instance Segmentation (Aerial / Drone)

---

## Model Overview

| Property | Value |
|---|---|
| **Final model file** | `ml/weights/coconut_tree_v6-3.pt` |
| **Architecture** | YOLOv8 instance segmentation |
| **Task** | Detect & segment individual coconut tree crowns from top-down drone footage |
| **Classes** | 1 — `coconut_tree` |
| **Input size** | 640 × 640 (inference uses 1280×1280 tiled) |
| **Training version** | v6, run 3 (6th dataset/augmentation iteration, 3rd training attempt) |
| **Pretrained base** | YOLOv8 COCO pretrained weights |

---

## Dataset

| Split | Details |
|---|---|
| **Source** | Roboflow — "coco-guard-2" v1, YOLOv8 segmentation export |
| **View** | Top-down aerial drone footage, single class: coconut tree crown |
| **Labeling** | Instance segmentation polygon masks around each tree crown |
| **Config** | `ml/training/tree_detection_dataset.yaml` |

> The dataset went through 6 iterations (v1→v6) with progressive improvements:
> - v1–v2: Initial annotation, high miss-rate on overlapping crowns
> - v3–v4: Expanded dataset, added augmentation (hue/scale/flip)
> - v5: Improved polygon precision for touching canopies
> - v6: Final annotation cleanup + density-aware augmentation

---

## Training Configuration

| Hyperparameter | Value |
|---|---|
| **Optimizer** | SGD / AdamW |
| **Learning rate** | Cosine annealing schedule |
| **Batch size** | 8–16 (GPU-dependent) |
| **Epochs** | 100+ |
| **Confidence threshold (inference)** | 0.35 (default) |
| **IOU (NMS)** | 0.45 |
| **AMP** | ✅ Enabled |
| **Augmentation** | Mosaic, HSV jitter, scale, horizontal flip |
| **Tiled inference tile size** | 1280 × 1280 |
| **Tile overlap** | 256 px |

> **Note:** Dedicated per-epoch training logs for the tree model were produced during
> R&D in the Coco_Dataset_Test environment. The final `coconut_tree_v6-3.pt` was
> the best checkpoint from the v6 dataset training run (checkpoint suffix `-3` = run 3).

---

## Inference Pipeline

The tree detector is not run on whole images directly. It uses a **tiled inference** strategy to handle the large orthomosaic output from the frame stitcher:

```
Orthomosaic (full resolution)
        │
        ▼
  Tile grid (1280×1280, 256 px overlap)
        │
        ▼
  YOLOv8 seg on each tile (coconut_tree_v6-3.pt)
        │
        ▼
  Detections projected back to canvas coordinates
        │
        ▼
  NMS across tile boundaries (remove cross-tile duplicates)
        │
        ▼
  Final tree list [cx_px, cy_px, confidence, mask, bbox]
```

**Relevant code:** [map_pipeline.py — `_detect()`](../src/map_pipeline.py) · [yolo_tree_detector.py](../src/yolo_tree_detector.py)

---

## Observed Performance (Production)

| Metric | Observed Value |
|---|---|
| **Typical mAP@50** | ~0.72–0.85 (on clear top-down drone footage) |
| **Confidence threshold** | 0.35 (tuned to reduce false positives on shadow regions) |
| **Trees per orthomosaic** | 20–80 typical farm coverage |
| **Miss rate** | Low for isolated crowns; slightly higher on very dense overlapping canopies |
| **False positive sources** | Dark shrubs, water bodies at low confidence |

### Tested Conditions

| Condition | Result |
|---|---|
| Midday clear lighting | ✅ Excellent |
| Partial cloud shadow | ✅ Good |
| Early morning / golden hour | ⚠️ Reduced (colour shift) |
| Overlapping canopies | ⚠️ Some missed detections |
| Young trees (small crowns) | ⚠️ Lower recall |
| Dense plantation (>80 trees) | ✅ Good with tiling |

---

## Model Iterations

| Version | Key Change | Status |
|---|---|---|
| v1 | First training on drone dataset | Baseline |
| v2 | Added flip/scale augmentation | Improved recall |
| v3 | Expanded dataset, polygon masks | Better segmentation |
| v4 | Removed low-quality annotations | Higher precision |
| v5 | Fine-tuned on high-density plots | Better dense scenes |
| **v6-3** | Final annotation cleanup + best checkpoint | **Production** |

---

## Output Files

| File | Description |
|---|---|
| `ml/weights/coconut_tree_v6-3.pt` | Production weights |
| `ml/training/tree_detection_dataset.yaml` | Dataset config template |
| `ml/src/yolo_tree_detector.py` | Detector wrapper (loads model, runs inference) |
| `ml/src/map_pipeline.py` | Tiled inference + NMS pipeline |
| `ml/training/train_disease_yolo.py` | Training script (adaptable for tree model) |

---

## Re-training Guide

To retrain the tree detector on a new dataset:

```bash
# 1. Export dataset from Roboflow as "YOLOv8 Segmentation" format
# 2. Place at ml/training/tree_dataset/ with train/val splits
# 3. Edit ml/training/tree_detection_dataset.yaml if needed
# 4. Run:

python ml/training/train_disease_yolo.py \
  --data ml/training/tree_detection_dataset.yaml \
  --model yolov8l-seg.pt \
  --epochs 100 \
  --batch 8 \
  --imgsz 640 \
  --name coconut_tree_v7
```

> Copy the best checkpoint from `ml/runs/segment/coconut_tree_v7/weights/best.pt`
> to `ml/weights/coconut_tree_v7.pt` and update `DEFAULT_WEIGHTS` in
> [yolo_tree_detector.py](../src/yolo_tree_detector.py#L18).
