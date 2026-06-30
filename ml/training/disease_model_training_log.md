# Training Log — `coconut_disease_v5.pt`
> Coconut Leaf Disease Detection · YOLOv8 Instance Segmentation

---

## Model Overview

| Property | Value |
|---|---|
| **Final model file** | `ml/weights/coconut_disease_v5.pt` |
| **Architecture** | YOLOv8l-seg (large, instance segmentation) |
| **Task** | Detect + segment disease regions on close-up coconut leaf images |
| **Classes** | 4 — Black Beetle Attack, Magnesium Deficiency, Potassium Deficiency, Yellow Patches |
| **Input size** | 640 × 640 |
| **Pretrained base** | YOLOv8l (COCO pretrained weights) |

---

## Dataset

| Split | Images | Notes |
|---|---|---|
| **Train** | 726 | Augmented; bounding box + segmentation polygon labels |
| **Val** | 223 | Held-out |
| **Total** | ~949 | "Coconut Leaf Pest Detection" dataset |
| **Source** | Roboflow export — YOLOv8 segmentation format |
| **Config** | `ml/training/disease_dataset.yaml` |

---

## Training Configuration (`args.yaml`)

| Hyperparameter | Value |
|---|---|
| **Optimizer** | AdamW |
| **Learning rate (lr0)** | 0.001 |
| **LR final (lrf)** | 0.01 |
| **LR schedule** | Cosine annealing (`cos_lr: true`) |
| **Momentum** | 0.937 |
| **Weight decay** | 0.0005 |
| **Batch size** | 8 |
| **Epochs** | 100 |
| **Early stopping patience** | 15 |
| **Warmup epochs** | 3 |
| **Warmup momentum** | 0.8 |
| **AMP (mixed precision)** | ✅ Enabled |
| **Mosaic augmentation** | 1.0 |
| **MixUp** | 0.1 |
| **HSV Hue / Sat / Val** | 0.015 / 0.7 / 0.4 |
| **Flip LR** | 0.5 |
| **Scale** | 0.5 |
| **Rotation** | ±10° |
| **Auto augment** | RandAugment |
| **Random erasing** | 0.4 |
| **Close mosaic last N epochs** | 10 |
| **IOU threshold** | 0.7 |
| **Box loss weight** | 7.5 |
| **Cls loss weight** | 0.5 |
| **DFL loss weight** | 1.5 |

---

## Training Run 1 — `training_20260226_223243.log`

**Date:** 2026-02-26 22:32  
**Base model:** `yolov8m.pt`  
**Dataset:** Coconut Leaf Pest Detection (726 train / 223 val)

### Per-Epoch Metrics (selected)

| Epoch | Box Loss | Cls Loss | DFL Loss | Precision | Recall | mAP@50 | mAP@50-95 |
|---|---|---|---|---|---|---|---|
| 2 | 1.9672 | 2.7160 | 2.2353 | 0.163 | 0.149 | 0.0864 | 0.0297 |
| 5 | 1.8467 | 2.4180 | 2.1529 | 0.597 | 0.275 | 0.2772 | 0.1222 |
| 10 | 1.7780 | 2.2443 | 2.0668 | 0.562 | 0.293 | 0.3067 | 0.1204 |
| 15 | 1.7129 | 2.1462 | 2.0212 | 0.365 | 0.362 | 0.3336 | 0.1604 |
| 20 | 1.7045 | 2.1123 | 1.9982 | 0.431 | 0.332 | 0.3424 | 0.1670 |
| 25 | 1.6725 | 2.0315 | 1.9654 | 0.364 | 0.355 | 0.3278 | 0.1523 |
| 30 | 1.6391 | 1.9429 | 1.9351 | 0.362 | 0.374 | 0.3512 | 0.1802 |
| 35 | 1.6212 | 1.9322 | 1.9114 | 0.365 | 0.391 | 0.3361 | 0.1689 |
| 40 | 1.5905 | 1.8577 | 1.8908 | 0.373 | 0.354 | 0.3367 | 0.1755 |
| **47** | **1.5477** | **1.7518** | **1.8499** | **0.397** | **0.393** | **0.3582** | **0.1974** |
| 50 | 1.5217 | 1.7234 | 1.8381 | 0.380 | 0.404 | 0.3391 | 0.1914 |
| 55 | 1.5156 | 1.6856 | 1.8298 | 0.413 | 0.362 | 0.3457 | 0.1901 |
| 67 | 1.4226 | 1.5255 | 1.7391 | 0.396 | 0.379 | 0.3230 | 0.1776 |
| 72 | 1.3999 | 1.4890 | 1.7241 | 0.408 | 0.409 | 0.3444 | 0.1943 |

> **Best epoch: 47** — mAP@50 = **0.3582**

---

## Training Run 2 — `training_20260227_001842.log`

**Date:** 2026-02-27 00:18  
**Base model:** `yolov8m.pt`  
**Dataset:** Coconut Leaf Pest Detection (726 train / 223 val)  
**Note:** Continuation / re-run for validation of hyperparameters

### Per-Epoch Metrics (selected from 100-epoch run)

| Epoch | Box Loss | Cls Loss | DFL Loss | mAP@50 | mAP@50-95 |
|---|---|---|---|---|---|
| 1 | 2.055 | 2.971 | 2.340 | — | — |
| 10 | — | — | — | ~0.30 | ~0.12 |
| 20 | — | — | — | ~0.33 | ~0.15 |
| 30 | — | — | — | ~0.35 | ~0.17 |
| 45 | 1.509 | 1.985 | 1.864 | 0.3436 | 0.1648 |
| 46 | 1.609 | 1.943 | 1.968 | ≈0.34 | ≈0.16 |

> Training throughput: ~3.5–3.8 it/s · GPU memory: ~3.4 GB

---

## Full Epoch-by-Epoch Results (`results.csv`)

> 99-epoch detection run — YOLOv8m, `imgsz=640`, `batch=8`, AdamW, cosine LR

| Epoch | Time (s) | Train Box | Train Cls | Train DFL | Precision | Recall | **mAP@50** | mAP@50-95 |
|---|---|---|---|---|---|---|---|---|
| 1 | 32.9 | 2.0546 | 2.9710 | 2.3401 | 0.890 | 0.122 | 0.151 | 0.062 |
| 5 | 151.7 | 1.9659 | 2.7745 | 2.3352 | 0.890 | 0.099 | 0.154 | 0.055 |
| 10 | 292.7 | 1.8412 | 2.5096 | 2.1849 | 0.578 | 0.280 | 0.279 | 0.136 |
| 15 | 434.3 | 1.8242 | 2.4811 | 2.1667 | 0.866 | 0.252 | 0.286 | 0.124 |
| 20 | 580.2 | 1.7438 | 2.3479 | 2.0902 | 0.722 | 0.258 | 0.292 | 0.144 |
| 25 | 727.0 | 1.7365 | 2.3041 | 2.0954 | 0.367 | 0.305 | 0.317 | 0.143 |
| 30 | 873.0 | 1.7382 | 2.2941 | 2.0754 | 0.714 | 0.297 | 0.325 | 0.160 |
| 35 | 1019.8 | 1.6931 | 2.1902 | 2.0364 | 0.365 | 0.332 | 0.328 | 0.164 |
| 40 | 1164.4 | 1.6674 | 2.1328 | 2.0154 | 0.383 | 0.335 | 0.331 | 0.157 |
| 45 | 1310.1 | 1.6560 | 2.1320 | 2.0068 | 0.364 | 0.351 | 0.344 | 0.165 |
| 50 | 1455.5 | 1.6284 | 2.0733 | 2.0018 | 0.422 | 0.358 | 0.343 | 0.171 |
| 55 | 1605.5 | 1.6215 | 2.0507 | 1.9888 | 0.419 | 0.368 | 0.351 | 0.169 |
| 60 | 1753.2 | 1.5821 | 1.9954 | 1.9507 | 0.414 | 0.366 | 0.354 | 0.178 |
| 62 | 1814.8 | 1.5786 | 1.9586 | 1.9417 | 0.407 | 0.378 | **0.358** | 0.181 |
| 65 | 1903.7 | 1.5643 | 1.9504 | 1.9245 | 0.414 | 0.372 | 0.354 | 0.174 |
| **67** | **1959.6** | **1.5837** | **1.9586** | **1.9548** | **0.412** | **0.378** | **0.363** | **0.176** |
| 70 | 2045.7 | 1.5579 | 1.9273 | 1.9220 | 0.390 | 0.364 | 0.350 | 0.174 |
| 75 | 2187.3 | 1.4901 | 1.8084 | 1.8745 | 0.339 | 0.394 | 0.349 | 0.182 |
| 80 | 2327.8 | 1.4980 | 1.8404 | 1.8791 | 0.356 | 0.365 | 0.346 | 0.186 |
| 85 | 2468.8 | 1.4922 | 1.7913 | 1.8809 | 0.421 | 0.348 | 0.349 | 0.183 |
| 90 | 2608.6 | 1.4689 | 1.7573 | 1.8580 | 0.412 | 0.345 | 0.343 | 0.181 |
| 95 | 2769.7 | 1.4479 | 1.6590 | 1.9113 | 0.353 | 0.383 | 0.339 | 0.182 |
| 99 | 2885.2 | 1.4363 | 1.6416 | 1.9176 | 0.351 | 0.385 | 0.337 | 0.183 |

> **Best epoch: 67** — mAP@50 = **0.363**  
> Total training time: ~48 minutes (2885 seconds)

---

## Final Model: `coconut_disease_v5.pt`

The production model was trained with **YOLOv8l-seg** (larger backbone than the logged runs above, which used YOLOv8m detection). Key upgrades for v5:

- **Architecture**: YOLOv8l-seg instead of YOLOv8m-detect — adds instance segmentation masks
- **Dataset**: 478 annotated close-up coconut leaf images (Roboflow, YOLOv8 segmentation format)
- **Classes**: 4 — Black Beetle Attack · Magnesium Deficiency · Potassium Deficiency · Yellow Patches
- **Training environment**: GPU (mixed precision AMP)
- **Weights output**: `ml/weights/coconut_disease_v5.pt`

### Runtime Performance

| Metric | Value |
|---|---|
| **Inference endpoint** | `POST /predict-disease` |
| **Confidence threshold** | 0.25 (auto, per class) |
| **Severity: High** | confidence ≥ 0.70 |
| **Severity: Medium** | confidence ≥ 0.40 |
| **Severity: Low** | confidence < 0.40 |
| **Output** | Annotated image (base64) · disease class · confidence · severity · remedy |

---

## Output Files (Training Artifacts)

| File | Description |
|---|---|
| `ml/runs/detect/train/results.csv` | Full per-epoch metrics |
| `ml/runs/detect/train/confusion_matrix.png` | Class confusion matrix |
| `ml/runs/detect/train/BoxPR_curve.png` | Precision-Recall curve |
| `ml/runs/detect/train/BoxF1_curve.png` | F1-Confidence curve |
| `ml/runs/detect/train/results.png` | Loss + metric plots |
| `ml/runs/detect/train/args.yaml` | Full hyperparameter config |
| `ml/runs/logs/training_20260226_223243.log` | Run 1 full stdout log |
| `ml/runs/logs/training_20260227_001842.log` | Run 2 full stdout log |
| `ml/training/train_disease_yolo.py` | Training script |
| `ml/training/disease_dataset.yaml` | Dataset config |
