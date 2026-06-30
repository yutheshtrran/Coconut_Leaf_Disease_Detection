# Coco-Guard — Coconut Leaf Disease Detection

A full-stack AI-powered platform for detecting diseases in coconut tree plantations using drone imagery, machine learning, and computer vision.

---

## Features

- **Two-stage disease analysis** — Detects individual tree crowns first (`coconut_tree_v6-3.pt`), then classifies disease per tree (`coconut_disease_v5.pt`)
- **Drone video farm map** — Upload a drone video to produce a stitched orthomosaic panorama with clickable per-tree disease overlays
- **Batch image analysis** — Upload multiple leaf/aerial images and get disease results per image
- **Interactive map viewer** — HTML5 canvas orthomosaic with pan, zoom, and click-to-analyse per tree
- **Report management** — Create, filter, finalise, and export PDF reports per farm
- **Farm & plot management** — Hierarchical farm → plot structure with GPS location picking
- **Disease reference library** — Admin-managed disease database with descriptions, impacts, and remedies
- **User management** — Role-based access (admin / agronomist / farmer / general), two-step email-verified registration
- **Dark mode** — Full light/dark theme support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router 7, Leaflet |
| Backend | Node.js, Express 5, MongoDB + Mongoose 8 |
| ML API | Python, Flask, Ultralytics YOLOv8, OpenCV, PyTorch |
| Auth | JWT (15 min access + 7 day refresh), bcrypt, HTTP-only cookies |
| Storage | Cloudinary (images & profile photos), MongoDB (structured data) |
| Email | SendGrid / Nodemailer |
| Deployment | Docker Compose |

---

## ML Models

Both models use **YOLOv8 instance segmentation** and live in `ml/weights/` (git-ignored).

| File | Classes | Role |
|---|---|---|
| `coconut_disease_v5.pt` | 4 disease classes | Leaf disease detection — used by `/predict`, `/predict-disease`, `/predict-trees` |
| `coconut_tree_v6-3.pt` | 1 (`coconut_tree`) | Tree crown detection from aerial imagery — stage 1 of the two-stage pipeline |

**Disease classes (coconut_disease_v5.pt):**
Black Beetle Attack · Magnesium Deficiency · Potassium Deficiency · Yellow Patches

No detections in a crop → reported as **Healthy**.

---

## Project Structure

```
Coconut_Leaf_Disease_Detection/
│
├── frontend/                       React 19 + Vite
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       Stats overview + recent reports
│       │   ├── Upload.jsx          Batch image & drone video analysis
│       │   ├── AnalyseImages.jsx   Two-stage tree + disease results
│       │   ├── FarmMapAnalysis.jsx Interactive orthomosaic viewer
│       │   ├── MyFarms.jsx         Farm & plot CRUD
│       │   ├── Reports.jsx         Report list, filter, PDF export
│       │   ├── ManageDiseases.jsx  Disease reference library (admin)
│       │   ├── Admin.jsx           Profile, security, activity tabs
│       │   └── Login, Register, VerifyEmail, ForgotPassword, …
│       ├── components/
│       │   ├── Sidebar.jsx         Navigation + user profile + logout
│       │   └── …
│       ├── services/
│       │   ├── api.js              Axios instance + JWT auto-refresh
│       │   ├── farmMapService.js   ML API calls (farm map pipeline)
│       │   └── …
│       └── context/
│           ├── AuthContext.jsx     Global auth state + all auth ops
│           └── ThemeContext.jsx    Light/dark persistence
│
├── backend/                        Node.js + Express 5
│   ├── models/                     User, Farm, Plot, Report, Disease,
│   │                               Image, DroneFlight, PendingUser
│   ├── controllers/                auth, farm, plot, report, disease,
│   │                               user, flight, alert
│   ├── routes/                     /api/auth /api/farms /api/plots
│   │                               /api/reports /api/diseases /api/users
│   ├── middleware/                 authMiddleware, roleMiddleware, errorHandler
│   └── services/                  emailService, cloudinaryService, pdfService
│
├── ml/
│   ├── src/
│   │   ├── app.py                  Flask API server (port 5001)
│   │   ├── yolo_tree_detector.py   coconut_tree_v6-3.pt wrapper
│   │   ├── segmentation_enhanced.py Watershed tree segmentation
│   │   ├── stitch_opencv.py        Video → orthomosaic stitcher
│   │   ├── gpu_warp.py             GPU affine warping (PyTorch)
│   │   ├── map_pipeline.py         Async farm-map job orchestration
│   │   ├── frame_tree_detector.py  Tile-based YOLO on large orthomosaics
│   │   ├── video_service.py        Video frame extraction
│   │   └── config.yaml             Class names, training params
│   ├── training/
│   │   └── train_disease_yolo.py   YOLO training pipeline (prep → train → deploy)
│   ├── weights/                    Model files (git-ignored)
│   └── logs/
│       └── disease_info.json       Disease descriptions, impacts, remedies
│
├── docker-compose.yml
├── README.md
├── RUN_GUIDE.md
└── REPO_GUIDE.md                   Full developer reference (all files explained)
```

---

## Service Ports

| Service | Port |
|---|---|
| Frontend (Vite dev) | 5173 |
| Backend (Express) | 5000 |
| ML API (Flask) | 5001 |
| MongoDB | 27017 |

---

## Backend API Endpoints

All routes are prefixed `/api/`. Protected routes require a valid JWT cookie.

### Auth (`/api/auth`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Step 1 — send 6-digit verification code to email |
| POST | `/register/confirm` | Step 2 — verify code, create account, issue JWT |
| POST | `/login` | Email/password → access + refresh tokens (HttpOnly cookies) |
| POST | `/refresh` | Refresh expired access token |
| POST | `/logout` | Invalidate refresh token |
| GET | `/me` | Get current user profile |
| POST | `/forgot` | Send password reset code |
| POST | `/forgot/confirm` | Verify code + set new password |

### Farms & Plots (`/api/farms`)

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/` | List user's farms / Create farm |
| GET/PUT/DELETE | `/:farmId` | Get, update, or delete a farm |
| GET/POST | `/:farmId/plots` | List plots in farm / Add plot |
| GET/PUT/DELETE | `/:farmId/plots/:plotId` | Plot CRUD |

### Reports (`/api/reports`)

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/` | List all reports / Create report |
| GET/PUT/DELETE | `/:id` | Get, update, or delete a report |
| GET | `/:id/download` | Generate and download PDF |
| GET | `/:id/preview` | Preview report JSON |

### Diseases, Users, Flights

| Route prefix | Description |
|---|---|
| `/api/diseases` | Disease library CRUD (sample image upload, admin-managed) |
| `/api/users` | Profile management, profile photo (Cloudinary), admin user ops |
| `/api/flights` | Drone flight metadata CRUD |

---

## ML API Endpoints

All served by the Flask server on port 5001.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/predict` | Single-image disease classification (4 classes, YOLOv8) |
| POST | `/predict-disease` | Disease detection with full segmentation masks |
| POST | `/predict-trees` | **Two-stage**: tree detection → per-tree disease |
| POST | `/process-drone-images` | Multi-image stitch → panorama → per-tree disease |
| POST | `/process-drone-video` | Video → frames → stitch → per-tree disease |
| POST | `/farm-map/start` | Start async farm map job, returns `session_id` |
| GET | `/farm-map/progress/<id>` | Poll job progress (0–100%) |
| GET | `/farm-map/result/<id>` | Get orthomosaic + tree list when done |
| POST | `/farm-map/disease/<id>/<tree_id>` | On-demand per-tree disease analysis |
| POST | `/analyze-video` | Frame-level video analysis |

---

## How the Pipelines Work

### Two-Stage Disease Detection (`/predict-trees`)

```
Input image
    │
    ├─ Stage 1: coconut_tree_v6-3.pt
    │           → bounding boxes for each tree crown
    │
    └─ Stage 2: for each tree crop + 10% padding:
                  coconut_disease_v5.pt
                  → disease + confidence
                  → no detections = Healthy

    Fallback: if 0 trees detected → run disease on full image
```

### Drone Farm Map Pipeline (`/farm-map/start`)

```
Drone video uploaded → async job returns session_id

Stage 1 — Stitching (stitch_opencv.py):
  Extract frames → cascade feature matchers
  (DISK → SuperPoint → ORB → AKAZE → LoFTR → phase correlation)
  → compute homographies → warp frames onto canvas
  → cosine-taper blending → orthomosaic PNG

Stage 2 — Tree Detection (frame_tree_detector.py):
  Tile orthomosaic (1280px tiles, 256px overlap)
  → run coconut_tree_v6-3.pt per tile
  → merge detections + NMS
  → list of trees with (cx, cy, radius)

Stage 3 — Disease Classification:
  For each tree: extract best-quality crop from source frames
  → run coconut_disease_v5.pt per crop
  → disease name + confidence stored

Frontend polls /farm-map/progress → renders orthomosaic on canvas
User clicks tree → POST /farm-map/disease/{id}/{tree_id} → disease popup
```

---

## User Roles

| Role | Permissions |
|---|---|
| `admin` | Full access — all CRUD, user management, disease management |
| `agronomist` | Create & manage reports, read all data |
| `farmer` | Read-only reports and analysis, manage own farms |
| `general` | Read-only access |

---

## Environment Variables

Create `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/coconut_disease_db
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
PORT=5000
CLIENT_URL=http://localhost:5173

# Email
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@yourdomain.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## Installation

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- CUDA-capable GPU (recommended for ML inference)

### 1. Clone

```bash
git clone <repository-url>
cd Coconut_Leaf_Disease_Detection
```

### 2. Place model weights

Copy the following into `ml/weights/` (not tracked by git):

```
ml/weights/coconut_disease_v5.pt
ml/weights/coconut_tree_v6-3.pt
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env    # fill in your values
```

### 4. ML API

```bash
cd ml
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
pip install ultralytics flask flask-cors opencv-python pillow pyyaml scikit-learn numpy
```

### 5. Frontend

```bash
cd frontend
npm install
```

### 6. Run (Docker alternative)

```bash
docker-compose up --build
```

See [RUN_GUIDE.md](RUN_GUIDE.md) for step-by-step startup instructions and common troubleshooting.  
See [REPO_GUIDE.md](REPO_GUIDE.md) for a full developer reference covering every file and how it works.

---

## License

MIT License.
