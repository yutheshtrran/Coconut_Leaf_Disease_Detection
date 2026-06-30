# 🌴 Coco-Guard — Git Collaboration Guide
### 3-Member Branch Strategy: Muhthaseem · Yutheshtraan · Rashmi

---

## 📋 Overview

Since all work was done on a single machine, the goal is to:
1. Connect the local repo to GitHub (if not already done)
2. Each person creates **their own branch**
3. Each person stages **only their own files** and commits them
4. All branches are pushed to GitHub
5. Each branch is merged into `main` via Pull Requests

---

## ⚡ STEP 0 — One-Time Setup (Done Once by Any One Person)

> Run these commands **once** from the project root before anyone else does anything.

### 0.1 — Verify git is initialized

```powershell
cd "D:\M3 Projects\Coconut_Leaf_Disease_Detection"
git status
```

If you see `fatal: not a git repository`, run:

```powershell
git init
```

### 0.2 — Connect to GitHub remote

```powershell
git remote add origin https://github.com/<your-username>/Coconut_Leaf_Disease_Detection.git
```

> Replace `<your-username>` with your actual GitHub username.
> If remote already exists, skip this step (verify with `git remote -v`).

### 0.3 — Make sure `.gitignore` covers large/private files

Verify these patterns are in `.gitignore`:

```
.venv/
node_modules/
ml/weights/
ml/uploads/
ml/videoframes/
ml/runs/
backend/.env
frontend/.env
*.pt
ml/src/yolov8m-seg.pt
ml/src/yolov8s-worldv2.pt
```

### 0.4 — Create and push the initial `main` branch

```powershell
git checkout -b main
git add README.md REPO_GUIDE.md RUN_GUIDE.md GIT_COLLABORATION_GUIDE.md .gitignore docker-compose.yml package.json package-lock.json
git commit -m "chore: initial repo skeleton and documentation"
git push -u origin main
```

---

## 👤 MUHTHASEEM'S BRANCH

> **Work:** Dataset annotation, model training pipeline, YOLOv8 disease model (mAP50 = 60%), YOLOv8 tree detection model (mAP50 = 97.5%), augmentation scripts, preprocessing, evaluation

### Step 1 — Switch to main and pull latest

```powershell
cd "D:\M3 Projects\Coconut_Leaf_Disease_Detection"
git checkout main
git pull origin main
```

### Step 2 — Create your branch

```powershell
git checkout -b feature/muhthaseem-ml-training
```

### Step 3 — Stage only your files

```powershell
# ── ML Source: Training & Preprocessing ──────────────────────────────
git add ml/src/train.py
git add ml/src/train_custom_yolo.py
git add ml/src/split_dataset.py
git add ml/src/dataset.py
git add ml/src/data_loader.py
git add ml/src/auto_annotate.py
git add ml/src/evaluate.py
git add ml/src/evaluate_model.py
git add ml/src/metrics.py
git add ml/src/model.py
git add ml/src/utils.py
git add ml/src/config.yaml
git add ml/src/verifyGPU.py

# ── ML Training Directory ────────────────────────────────────────────
git add ml/training/train_disease_yolo.py
git add ml/training/disease_dataset.yaml
git add ml/training/tree_detection_dataset.yaml
git add ml/training/disease_model_training_log.md
git add ml/training/tree_model_training_log.md

# ── Notebooks ────────────────────────────────────────────────────────
git add ml/notebooks/augmentation_demo.ipynb
git add ml/notebooks/eda.ipynb
git add ml/notebooks/evaluation.ipynb
git add ml/notebooks/model_training.ipynb
git add ml/notebooks/segmentation_accuracy_evaluation.ipynb

# ── ML Logs & Reports ────────────────────────────────────────────────
git add ml/training_history.json
git add ml/annotations.json
git add ml/reports/

# ── Documentation ────────────────────────────────────────────────────
git add docs/YOLO_ANNOTATION_GUIDE.md
git add docs/proposal/
git add docs/references/
git add docs/reports/
```

### Step 4 — Commit

```powershell
git commit -m "feat(ml): training pipeline, augmentation, evaluation and YOLOv8 models

- Annotated coconut leaf images with bounding boxes and polygon segmentation
- Implemented stratified train/valid/test split with minority class augmentation
  (5x oversample magnesium deficiency, 2x black beetle attack)
- Trained YOLOv8s-seg disease model with custom Albumentations pipeline
  Disease detection mAP50 = 60%
- Trained separate coconut tree crown detection model
  Tree detection mAP50 = 97.5%
- Added evaluation scripts and per-class confidence threshold sweep
- Added EDA, augmentation demo and evaluation notebooks"
```

### Step 5 — Push your branch

```powershell
git push -u origin feature/muhthaseem-ml-training
```

---

## 👤 YUTHESHTRAAN'S BRANCH

> **Work:** Drone-to-orthomosaic stitching, tiled YOLO inference, per-tree crop extraction, farm map visualization overlay

### Step 1 — Switch to main and pull latest

```powershell
cd "D:\M3 Projects\Coconut_Leaf_Disease_Detection"
git checkout main
git pull origin main
```

### Step 2 — Create your branch

```powershell
git checkout -b feature/yutheshtraan-drone-pipeline
```

### Step 3 — Stage only your files

> ⚠️ First, add large pre-trained base weights to `.gitignore` (if not already):
>
> ```powershell
> echo "ml/src/yolov8m-seg.pt" >> .gitignore
> echo "ml/src/yolov8s-worldv2.pt" >> .gitignore
> git add .gitignore
> ```

```powershell
# ── Drone Stitching Pipeline ─────────────────────────────────────────
git add ml/src/stitch_opencv.py

# ── Tiled YOLO Tree Detection & NMS ──────────────────────────────────
git add ml/src/frame_tree_detector.py
git add ml/src/yolo_tree_detector.py

# ── Per-Tree Crop Extraction & Video Frame Handling ───────────────────
git add ml/src/video_service.py

# ── GPU Warping ───────────────────────────────────────────────────────
git add ml/src/gpu_warp.py

# ── Drone Pipeline Orchestration ──────────────────────────────────────
git add ml/src/drone_pipeline.py
git add ml/src/drone_pipeline_enhanced.py
git add ml/src/map_pipeline.py

# ── Segmentation ──────────────────────────────────────────────────────
git add ml/src/segmentation.py

# ── Farm Map Job Store ────────────────────────────────────────────────
git add ml/farm_map_jobs/

# ── Small model weights (safe to commit — under 10MB) ─────────────────
git add ml/yolo26n.pt
git add ml/yolov8n-seg.pt
```

### Step 4 — Commit

```powershell
git commit -m "feat(drone): orthomosaic stitching, tiled YOLO, and farm map pipeline

- Built drone video to orthomosaic stitching (stitch_opencv.py)
  ORB consecutive-frame feature matching with cosine-taper blending
- Built tiled YOLOv8 inference on orthomosaic (frame_tree_detector.py)
  1280x1280 tiles, 40% overlap, cross-tile NMS, centroid-based dedup
  Tree detection mAP50 = 97%
- Implemented per-tree best-frame crop extraction via inverse projection
  from orthomosaic back to original video frames, sharpness selection
- Built farm map visualization overlay with per-tree bounding boxes
- Added async farm map job orchestration (map_pipeline.py)
- GPU affine warping via PyTorch (gpu_warp.py)"
```

### Step 5 — Push your branch

```powershell
git push -u origin feature/yutheshtraan-drone-pipeline
```

---

## 👤 RASHMI'S BRANCH

> **Work:** Data preprocessing / background removal, Flask ML API server, model integration (lazy-loading + caching), full end-to-end pipeline integration, Node.js/Express backend, React frontend integration

### Step 1 — Switch to main and pull latest

```powershell
cd "D:\M3 Projects\Coconut_Leaf_Disease_Detection"
git checkout main
git pull origin main
```

### Step 2 — Create your branch

```powershell
git checkout -b feature/rashmi-backend-integration
```

### Step 3 — Stage only your files

```powershell
# ── Flask ML API Server (main inference entry point) ──────────────────
git add ml/src/app.py
git add ml/src/inference.py
git add ml/src/panorama_inference.py
git add ml/src/segmentation_enhanced.py

# ── Background Removal Notebook ───────────────────────────────────────
git add ml/notebooks/bg_remover.ipynb

# ── Disease Info / ML Logs ────────────────────────────────────────────
git add ml/logs/

# ── Node.js Express Backend ───────────────────────────────────────────
git add backend/server.js
git add backend/package.json
git add backend/package-lock.json
git add backend/Dockerfile
git add backend/README.md
git add backend/auth_smoke.ps1
git add backend/cleanupTestUser.js
git add backend/test-mongo-connection.js
git add backend/test-sendgrid.js
git add backend/test-dns-custom.js
git add backend/testConn.js

# Backend Models
git add backend/models/User.js
git add backend/models/Farm.js
git add backend/models/Plot.js
git add backend/models/Report.js
git add backend/models/Disease.js
git add backend/models/DroneFlight.js
git add backend/models/Image.js
git add backend/models/PendingUser.js

# Backend Controllers
git add backend/controllers/authController.js
git add backend/controllers/userController.js
git add backend/controllers/reportController.js
git add backend/controllers/farmController.js
git add backend/controllers/plotController.js
git add backend/controllers/diseaseController.js
git add backend/controllers/flightController.js
git add backend/controllers/alertController.js
git add backend/controllers/mlController.js

# Backend Routes
git add backend/routes/authRoutes.js
git add backend/routes/userRoutes.js
git add backend/routes/reportRoutes.js
git add backend/routes/farmRoutes.js
git add backend/routes/plotRoutes.js
git add backend/routes/diseaseRoutes.js
git add backend/routes/flightRoutes.js
git add backend/routes/alertRoutes.js
git add backend/routes/mlRoutes.js

# Backend Middleware & Services
git add backend/middleware/authMiddleware.js
git add backend/middleware/roleMiddleware.js
git add backend/middleware/errorHandler.js
git add backend/services/emailService.js
git add backend/services/cloudinary.js
git add backend/services/pdfService.js
git add backend/services/ml_services.js
git add backend/services/inferenceService.js
git add backend/services/storageService.js
git add backend/services/smsService.js

# Backend Config, Migrations, Scripts, Tests
git add backend/config/
git add backend/migrations/
git add backend/scripts/
git add backend/tests/

# ── React Frontend ────────────────────────────────────────────────────
git add frontend/index.html
git add frontend/package.json
git add frontend/package-lock.json
git add frontend/vite.config.js
git add frontend/tailwind.config.js
git add frontend/postcss.config.js
git add frontend/eslint.config.js
git add frontend/README.md
git add frontend/.env.example
git add frontend/.gitignore

# Frontend Source Files
git add frontend/src/main.jsx
git add frontend/src/index.jsx
git add frontend/src/App.jsx
git add frontend/src/App.css
git add frontend/src/index.css

# Frontend Pages (all 16 pages)
git add frontend/src/pages/

# Frontend Components (all 20 components)
git add frontend/src/components/

# Frontend Context, Services, Hooks, Utils, Styles, Assets
git add frontend/src/context/
git add frontend/src/services/
git add frontend/src/hooks/
git add frontend/src/utils/
git add frontend/src/styles/
git add frontend/src/assets/

# ── Deployment ────────────────────────────────────────────────────────
git add deployment/

# ── Design Docs ───────────────────────────────────────────────────────
git add docs/design/
```

### Step 4 — Commit

```powershell
git commit -m "feat(backend+frontend): Flask ML API, Express backend, and React frontend

- Built Flask ML API (app.py) with all inference endpoints:
  /predict, /predict-disease, /predict-trees (two-stage pipeline)
  /process-drone-images, /process-drone-video
  /farm-map/start, /farm-map/progress, /farm-map/result
  /farm-map/disease, /analyze-video
- Integrated coconut_disease_v5.pt and coconut_tree_v6-3.pt
  with lazy-loading singleton and thread-safe model caching
- Preprocessed disease dataset: resizing, normalization, background removal
- Built Node.js/Express backend:
  JWT auth (15min access + 7day refresh, HTTP-only cookies)
  Two-step email-verified registration with 6-digit OTP
  Farm/Plot/Report/Disease/User CRUD APIs
  Cloudinary image storage, SendGrid email, PDF export
- Built React 19 frontend (Vite + Tailwind CSS):
  Dashboard, Upload, FarmMapAnalysis, AnalyseImages, MyFarms,
  Reports, ManageDiseases, Admin, UserManagement pages
  AuthContext, ThemeContext, ProtectedRoute, Sidebar navigation
  Interactive HTML5 canvas farm map with per-tree disease popups
- Added Docker Compose and nginx deployment configs"
```

### Step 5 — Push your branch

```powershell
git push -u origin feature/rashmi-backend-integration
```

---

## 🔀 MERGING ALL BRANCHES INTO MAIN

### Method A — GitHub Pull Requests (Recommended ✅)

1. Go to your GitHub repo page
2. You'll see a banner: *"Compare & pull request"* — click it for each branch
3. Set **base: `main`** ← **compare: `feature/<branch-name>`**
4. Add a description and click **"Create pull request"**
5. Click **"Merge pull request"** → **"Confirm merge"**
6. Repeat for all three branches

**Recommended merge order (least to most complex):**
1. `feature/muhthaseem-ml-training` — training & data, no conflicts expected
2. `feature/yutheshtraan-drone-pipeline` — drone pipeline, no conflicts expected
3. `feature/rashmi-backend-integration` — backend & frontend, largest, goes last

---

### Method B — Command Line Merge (Alternative)

```powershell
# ── Merge Muhthaseem's branch ─────────────────────────────────────────
git checkout main
git pull origin main
git merge --no-ff feature/muhthaseem-ml-training -m "merge: Muhthaseem's ML training and dataset pipeline"
git push origin main

# ── Merge Yutheshtraan's branch ───────────────────────────────────────
git pull origin main
git merge --no-ff feature/yutheshtraan-drone-pipeline -m "merge: Yutheshtraan's drone stitching and farm map pipeline"
git push origin main

# ── Merge Rashmi's branch ─────────────────────────────────────────────
git pull origin main
git merge --no-ff feature/rashmi-backend-integration -m "merge: Rashmi's Flask API, Express backend, and React frontend"
git push origin main
```

---

## ⚠️ Handling Merge Conflicts

If a conflict occurs (e.g., both people edited `.gitignore`):

```powershell
# Git will list conflicting files:
git status
# Look for: "both modified: <filename>"

# Open the file — you'll see markers like:
# <<<<<<< HEAD
# (your local version)
# =======
# (incoming version)
# >>>>>>> feature/branch-name

# Manually edit the file to keep the correct combined content
# Then mark as resolved and commit:
git add <conflicting-file>
git commit -m "fix: resolve merge conflict in <filename>"
git push origin main
```

---

## 🗂️ File Ownership Quick Reference

| File / Folder | Owner |
|---|---|
| `ml/src/train.py` | Muhthaseem |
| `ml/src/train_custom_yolo.py` | Muhthaseem |
| `ml/src/split_dataset.py` | Muhthaseem |
| `ml/src/dataset.py` | Muhthaseem |
| `ml/src/data_loader.py` | Muhthaseem |
| `ml/src/auto_annotate.py` | Muhthaseem |
| `ml/src/evaluate.py` | Muhthaseem |
| `ml/src/evaluate_model.py` | Muhthaseem |
| `ml/src/metrics.py` | Muhthaseem |
| `ml/src/model.py` | Muhthaseem |
| `ml/src/utils.py` | Muhthaseem |
| `ml/src/config.yaml` | Muhthaseem |
| `ml/src/verifyGPU.py` | Muhthaseem |
| `ml/training/` *(all files)* | Muhthaseem |
| `ml/notebooks/augmentation_demo.ipynb` | Muhthaseem |
| `ml/notebooks/eda.ipynb` | Muhthaseem |
| `ml/notebooks/evaluation.ipynb` | Muhthaseem |
| `ml/notebooks/model_training.ipynb` | Muhthaseem |
| `ml/notebooks/segmentation_accuracy_evaluation.ipynb` | Muhthaseem |
| `ml/training_history.json` | Muhthaseem |
| `ml/annotations.json` | Muhthaseem |
| `ml/reports/` | Muhthaseem |
| `docs/YOLO_ANNOTATION_GUIDE.md` | Muhthaseem |
| `docs/proposal/` | Muhthaseem |
| `docs/references/` | Muhthaseem |
| `docs/reports/` | Muhthaseem |
| `ml/src/stitch_opencv.py` | Yutheshtraan |
| `ml/src/frame_tree_detector.py` | Yutheshtraan |
| `ml/src/yolo_tree_detector.py` | Yutheshtraan |
| `ml/src/video_service.py` | Yutheshtraan |
| `ml/src/gpu_warp.py` | Yutheshtraan |
| `ml/src/drone_pipeline.py` | Yutheshtraan |
| `ml/src/drone_pipeline_enhanced.py` | Yutheshtraan |
| `ml/src/map_pipeline.py` | Yutheshtraan |
| `ml/src/segmentation.py` | Yutheshtraan |
| `ml/farm_map_jobs/` | Yutheshtraan |
| `ml/yolo26n.pt` | Yutheshtraan |
| `ml/yolov8n-seg.pt` | Yutheshtraan |
| `ml/src/app.py` | Rashmi |
| `ml/src/inference.py` | Rashmi |
| `ml/src/panorama_inference.py` | Rashmi |
| `ml/src/segmentation_enhanced.py` | Rashmi |
| `ml/notebooks/bg_remover.ipynb` | Rashmi |
| `ml/logs/` | Rashmi |
| `backend/` *(all files)* | Rashmi |
| `frontend/` *(all files)* | Rashmi |
| `deployment/` | Rashmi |
| `docs/design/` | Rashmi |

---

## 💡 Tips & Best Practices

### Always pull before starting new work
```powershell
git checkout main
git pull origin main
git checkout feature/<your-branch>
git merge main   # bring in any new main changes into your branch
```

### Check what you're staging before committing
```powershell
git status          # see all staged / unstaged files
git diff --staged   # preview exactly what goes into the commit
```

### NEVER commit these files
| File | Reason |
|---|---|
| `backend/.env` | Contains DB passwords, JWT secrets, API keys |
| `frontend/.env` | Contains API URLs with potential secrets |
| `ml/weights/*.pt` | Custom trained model files — share via Google Drive |
| `ml/src/yolov8m-seg.pt` | 55MB pre-trained weight — too large for Git |
| `ml/src/yolov8s-worldv2.pt` | 26MB pre-trained weight — too large for Git |

### Clean up branches after merging
```powershell
# Delete local branch
git branch -d feature/muhthaseem-ml-training

# Delete remote branch on GitHub
git push origin --delete feature/muhthaseem-ml-training
```

---

## 📌 Quick Reference — All Key Commands

```powershell
git checkout main                          # switch to main
git pull origin main                       # get latest from GitHub
git checkout -b feature/<name>             # create new branch
git add <file>                             # stage a specific file
git add <folder>/                          # stage an entire folder
git status                                 # see what is staged
git diff --staged                          # preview commit content
git commit -m "type(scope): message"       # commit with message
git push -u origin feature/<name>          # push branch to GitHub
git log --oneline --graph --all            # view branch history tree
```
