# Run Guide

How to start all three services for local development.

---

## Prerequisites

- Node.js 18+
- Python 3.10+ with a virtual environment set up under `Coconut_Leaf_Disease_Detection/.venv/`
- MongoDB running locally on port 27017 (or a remote URI in `backend/.env`)
- Model weights placed in `ml/weights/` — see [Model Weights](#model-weights)

---

## Model Weights

The following files must be present in `ml/weights/` (they are git-ignored):

| File | Purpose |
|---|---|
| `coconut_disease_v5.pt` | YOLOv8 seg — disease detector used by `/predict`, `/predict-disease`, and `/predict-trees` |
| `coconut_tree_v6-3.pt` | YOLOv8 seg — coconut tree crown detector (stage 1 of two-stage pipeline) |

---

## 1. Backend (Node.js / Express)

```powershell
cd backend
npm install        # first time only
npm run dev
```

- Runs on **http://localhost:5000**
- Configured via `backend/.env` — copy from `.env.example` and fill in your values

---

## 2. ML API (Python / Flask)

```powershell
# Activate virtual environment
& "d:/M3 Projects/Coconut_Leaf_Disease_Detection/.venv/Scripts/Activate.ps1"

cd ml/src
python app.py run
```

- Runs on **http://localhost:5001**
- On first startup, prints a diagnostic check (model found, class names, YOLO availability)
- GPU is used automatically if CUDA is available; falls back to CPU

### Available endpoints

| Endpoint | Description |
|---|---|
| `POST /predict` | YOLOv8 single-image disease classification (4 classes) |
| `POST /predict-disease` | YOLOv8 disease detection with segmentation masks |
| `POST /predict-trees` | **Two-stage**: tree detection → per-tree disease detection |
| `POST /process-drone-images` | Multi-image panorama + tree segmentation + per-tree disease |
| `POST /process-drone-video` | Drone video → frames → panorama → tree detection + disease |
| `POST /farm-map/start` | Start async farm map job |
| `GET  /farm-map/progress/<session_id>` | Poll job progress |
| `GET  /farm-map/result/<session_id>` | Fetch completed map + tree list |
| `POST /farm-map/disease/<session_id>/<tree_id>` | On-demand per-tree disease analysis |
| `GET  /health` | Health check |

### Two-stage pipeline (`/predict-trees`)

1. `coconut_tree_v6-3.pt` detects individual tree crowns in the uploaded image
2. Each tree crop is passed to `coconut_disease_v5.pt` (same model as `/predict-disease`)
3. No YOLO detections in a crop → **Healthy**; any detection → highest-confidence disease is reported
4. Annotated image returned with coloured bounding boxes per tree

---

## 3. Frontend (React / Vite)

```powershell
cd frontend
npm install        # first time only
npm run dev
```

- Runs on **http://localhost:5173**
- Connects to backend at `http://localhost:5000/api`
- Connects to ML API at `http://127.0.0.1:5001`

---

## Port Summary

| Service | Port |
|---|---|
| Frontend (Vite) | 5173 |
| Backend (Express) | 5000 |
| ML API (Flask) | 5001 |
| MongoDB | 27017 |

Ensure no other processes are occupying these ports before starting.

---

## Running with Docker

```powershell
docker-compose up --build
```

This starts all services together. Frontend is served on port 3000 in Docker mode.

---

## Common Issues

**ML API won't start — model not found**
Ensure `ml/weights/coconut_disease_v5.pt` and `ml/weights/coconut_tree_v6-3.pt` exist.

**`/predict-trees` returns `"YOLO not available"`**
Install ultralytics: `pip install ultralytics`

**Backend can't connect to MongoDB**
Check `MONGODB_URI` in `backend/.env`. Start MongoDB with `mongod` if running locally.

**Frontend shows 401 on every request**
The access token expired. The Axios interceptor handles refresh automatically — if it keeps failing, check that `backend/.env` has the correct `JWT_SECRET` and `JWT_REFRESH_SECRET`.
