# Coconut Leaf Disease Detection — Complete Repository Guide

A full-stack AI-powered platform for detecting diseases in coconut tree plantations using drone imagery, machine learning, and computer vision. This guide explains every significant file and folder, how the application is built, how the ML models were trained, and how each feature works end-to-end.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Backend — Node.js / Express / MongoDB](#4-backend)
5. [Frontend — React 19 / Vite](#5-frontend)
6. [ML API — Python / Flask](#6-ml-api)
7. [ML Model Training](#7-ml-model-training)
8. [Key Data Flows](#8-key-data-flows)
9. [Configuration & Environment](#9-configuration--environment)
10. [Docker Deployment](#10-docker-deployment)

---

## 1. Project Overview

**Coco-Guard** is a three-tier web application that lets farmers and agronomists:

- Upload leaf or aerial images and get disease predictions per coconut tree
- Upload drone videos that are stitched into orthomosaic panoramas with per-tree disease overlays
- Manage farms, plots, reports, and disease references
- Administer users and roles via a secured dashboard

**Two trained YOLO models power the ML backend:**

| Model | Architecture | Classes | Role |
|---|---|---|---|
| `coconut_disease_v5.pt` | YOLOv8 instance segmentation | 4 disease classes | Disease detection on leaf or tree crops |
| `coconut_tree_v6-3.pt` | YOLOv8 instance segmentation | 1 class (coconut_tree) | Tree crown detection from aerial imagery |

**Disease classes detected:**
- Black Beetle Attack
- Magnesium Deficiency
- Potassium Deficiency
- Yellow Patches
- (No detection → reported as Healthy)

---

## 2. System Architecture

```
Browser (React 19 + Vite, port 5173)
        │
        │  REST / JSON (axios, with JWT cookie auth)
        ▼
Backend API (Node.js + Express 5, port 5000)
        │
        │  Mongoose ODM
        ▼
MongoDB (port 27017)
        │
        │  Cloudinary SDK (images)
        ▼
Cloudinary (cloud image storage)

Browser also calls directly ──────────────────────────────────────────┐
        │  fetch() with multipart/form-data                           │
        ▼                                                             │
ML API (Python + Flask, port 5001)                                    │
        │                                                             │
        ├── coconut_disease_v5.pt  (YOLOv8 seg, disease detection)   │
        ├── coconut_tree_v6-3.pt   (YOLOv8 seg, tree crown detection)│
        ├── stitch_opencv.py       (video → orthomosaic panorama)    │
        ├── segmentation_enhanced.py (watershed tree segmentation)    │
        ├── map_pipeline.py        (async farm-map job orchestration) │
        └── PyTorch / OpenCV / GPU warping                           │
                                                                      └─
```

**Key architectural decisions:**
- The **frontend calls the ML API directly** (not through the backend) to avoid proxying large video files through Node
- The ML API runs **async jobs** for long-running drone video pipelines (poll-based progress)
- **JWT tokens live in HttpOnly cookies** — the frontend never accesses them directly; Axios sends them automatically via `withCredentials: true`

---

## 3. Directory Structure

```
Coconut_Leaf_Disease_Detection/
│
├── backend/                      Node.js + Express API
│   ├── server.js                 App entry point (Express, CORS, MongoDB)
│   ├── package.json              Dependencies
│   ├── .env                      Environment variables (git-ignored)
│   ├── models/                   Mongoose database schemas
│   │   ├── User.js
│   │   ├── PendingUser.js
│   │   ├── Farm.js
│   │   ├── Plot.js
│   │   ├── Report.js
│   │   ├── Disease.js
│   │   ├── Image.js
│   │   └── DroneFlight.js
│   ├── controllers/              Business logic (one file per resource)
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── farmController.js
│   │   ├── plotController.js
│   │   ├── reportController.js
│   │   ├── diseaseController.js
│   │   ├── flightController.js
│   │   └── alertController.js
│   ├── routes/                   Express routers
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── farms.js
│   │   ├── reports.js
│   │   ├── diseases.js
│   │   ├── flights.js
│   │   └── alerts.js
│   ├── middleware/
│   │   ├── authMiddleware.js     JWT validation
│   │   ├── roleMiddleware.js     Role-based access control
│   │   └── errorHandler.js      Centralized error responses
│   └── services/
│       ├── emailService.js       SendGrid / Nodemailer
│       ├── cloudinaryService.js  Cloudinary image upload/delete
│       └── pdfService.js         PDF report generation
│
├── frontend/                     React 19 + Vite
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx              React entry (wraps AuthProvider, ThemeProvider)
│       ├── App.jsx               Router, all route definitions
│       ├── pages/
│       │   ├── Dashboard.jsx     Stats overview + recent reports
│       │   ├── Upload.jsx        Batch image + drone video analysis
│       │   ├── AnalyseImages.jsx Two-stage tree detection UI
│       │   ├── FarmMapAnalysis.jsx Orthomosaic viewer + clickable trees
│       │   ├── MyFarms.jsx       Farm & plot CRUD with map picker
│       │   ├── Reports.jsx       Report list, filter, PDF export
│       │   ├── ManageDiseases.jsx Disease reference library (admin)
│       │   ├── Admin.jsx         User profile, security, settings
│       │   ├── UserManagement.jsx Admin user list & role management
│       │   ├── Login.jsx
│       │   ├── Register.jsx      Two-step (form + email code)
│       │   ├── VerifyEmail.jsx   Code entry after registration
│       │   ├── ForgotPassword.jsx
│       │   ├── ResetPassword.jsx
│       │   └── AboutUs.jsx
│       ├── components/
│       │   ├── Sidebar.jsx       Navigation + user info + logout
│       │   ├── Navbar.jsx        Top app bar
│       │   ├── ProtectedRoute.jsx Route guard wrapper
│       │   ├── AuthLayout.jsx    Branding panel + form panel
│       │   ├── ReportCard.jsx    Single report row with actions
│       │   ├── ReportPreviewModal.jsx Modal for report JSON/PDF preview
│       │   ├── Toast.jsx         Toast notification
│       │   ├── ImageUpload.jsx   Drag-and-drop file selector
│       │   ├── DetectionResult.jsx Disease result card
│       │   ├── ErrorBoundary.jsx React error catcher
│       │   ├── ThemeToggle.jsx   Light/dark mode switch
│       │   ├── CodeInput.jsx     6-digit code entry (email verification)
│       │   ├── PasswordField.jsx Show/hide password toggle
│       │   ├── Profile.jsx       Profile editor (used in Admin)
│       │   ├── Security.jsx      Password change form
│       │   ├── Notifications.jsx Email/SMS preferences
│       │   └── Activity.jsx      Login history view
│       ├── context/
│       │   ├── AuthContext.jsx   Global auth state + all auth operations
│       │   └── ThemeContext.jsx  Light/dark mode persistence
│       └── services/
│           ├── api.js            Axios instance + JWT refresh interceptor
│           ├── authService.js    Auth API calls
│           ├── farmService.js    Farm & plot API calls
│           ├── farmMapService.js ML API calls (farm map pipeline)
│           ├── reportService.js  Report CRUD calls
│           └── userService.js    User profile & admin calls
│
├── ml/                           Python ML API
│   ├── src/
│   │   ├── app.py               Flask server — all API endpoints
│   │   ├── yolo_tree_detector.py coconut_tree_v6-3.pt wrapper
│   │   ├── segmentation_enhanced.py Watershed tree segmentation
│   │   ├── stitch_opencv.py     Video → orthomosaic stitching
│   │   ├── gpu_warp.py          GPU/CPU affine warping
│   │   ├── map_pipeline.py      Async farm-map job orchestration
│   │   ├── frame_tree_detector.py Tile-based YOLO on large orthomosaics
│   │   ├── video_service.py     Video frame extraction & analysis
│   │   ├── segmentation.py      Tree segmentation (used by video_service)
│   │   ├── auto_annotate.py     Interactive annotation tool (YOLO-based)
│   │   ├── evaluate_model.py    Model evaluation script
│   │   ├── train_custom_yolo.py YOLO training helper
│   │   └── config.yaml          class names, image size, training params
│   ├── training/
│   │   └── train_disease_yolo.py Full YOLO training pipeline
│   ├── weights/                  Model files (git-ignored)
│   │   ├── coconut_disease_v5.pt
│   │   └── coconut_tree_v6-3.pt
│   └── logs/
│       └── disease_info.json    Disease descriptions & remedies
│
├── docker-compose.yml
├── README.md
├── RUN_GUIDE.md
└── REPO_GUIDE.md                (this file)
```

---

## 4. Backend

### `backend/server.js` — Entry Point

Sets up the Express application:
- Registers CORS (allowed origin from `CLIENT_URL` env var)
- Parses JSON and URL-encoded bodies
- Attaches all routers under `/api/`
- Connects to MongoDB with Mongoose
- Adds the global error handler middleware last
- Listens on `PORT` (default 5000)

### Database Models (`backend/models/`)

**`User.js`** — Registered user accounts

| Field | Type | Notes |
|---|---|---|
| `username` | String, unique | Display name |
| `email` | String, unique, lowercase | Login credential |
| `password` | String | bcrypt hash (salt 10) |
| `role` | Enum | `admin`, `farmer`, `agronomist`, `general` |
| `emailVerified` | Boolean | Must be true to log in |
| `verifyCode` | String | 6-digit email code |
| `verifyExpires` | Date | Code expiry (15 min) |
| `refreshTokens` | Array | Valid refresh token list |
| `profileImage` | String | Cloudinary URL |

**`PendingUser.js`** — Temporary pre-registration holder

Stores new user data while waiting for email verification. Deleted on successful confirmation. Has a TTL index on `expiresAt` (15 min) so MongoDB auto-cleans unconfirmed registrations.

**`Farm.js`** — Farm container

Fields: `name`, `subtitle`, `location` (GPS coords), `area` (hectares), `admin` (ref User), `description`, `status`. Each farm belongs to one user (admin field).

**`Plot.js`** — Sub-division within a farm

Fields: `farm` (ref Farm), `name`, `area`, `status` (`LOW_RISK`/`MODERATE`/`CRITICAL`), `lastAnalyzed`, `description`. Queries always check farm ownership.

**`Report.js`** — Disease analysis reports

Fields: `reportId` (auto-incremented string e.g. `REP-001`), `farm`, `date`, `issue` (disease name), `severity` object (`{value: 0-100, label: LOW/MODERATE/HIGH/CRITICAL}`), `status` (`Pending`/`Finalized`), `userId` (ref User), `description`, `images` (array of URLs).

**`Disease.js`** — Disease reference library

Fields: `name` (unique), `description`, `impact`, `remedy`, `samples` (array of Cloudinary image URLs). Used to populate the ManageDiseases page.

**`DroneFlight.js`** — Drone flight metadata

Fields: `flightId` (unique), `droneId`, `userId`, `startTime`, `endTime`, `location` (GeoJSON Point with geospatial 2dsphere index), `images` (array), `createdAt`.

**`Image.js`** — Uploaded image tracking

Fields: `url`, `uploadedAt`, `annotations`, `user` (ref User), `metadata`.

---

### API Routes & Controllers

All routes are prefixed `/api/`. Protected routes require a valid JWT (checked by `authMiddleware`).

#### Auth (`/api/auth/`)

| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/register` | POST | No | Creates a `PendingUser` and sends 6-digit email code via `emailService` |
| `/register/confirm` | POST | No | Verifies code, creates permanent `User`, issues JWT pair, deletes PendingUser |
| `/register/resend` | POST | No | Resends code for pending registration (resets expiry) |
| `/login` | POST | No | Validates credentials, issues access token (15m) + refresh token (7d) in HttpOnly cookies |
| `/refresh` | POST | No | Validates refresh token from cookie, issues new access token |
| `/logout` | POST | Yes | Removes refresh token from user's token list |
| `/me` | GET | Yes | Returns full user profile from DB |
| `/forgot` | POST | No | Sends password reset code to email |
| `/forgot/confirm` | POST | No | Verifies reset code, updates password |

**`authController.js`** implements the two-step registration logic:
1. `startRegister`: Creates `PendingUser`, generates 6-digit code, calls `emailService.sendVerificationCode()`
2. `confirmRegister`: Finds `PendingUser` by email + code, checks expiry, calls `bcrypt.hash()` on password, creates `User`, signs both tokens, sets HttpOnly cookies, deletes the `PendingUser` document

JWT signing: access token signed with `JWT_SECRET`, 15-minute expiry; refresh token signed with `JWT_REFRESH_SECRET`, 7-day expiry. Both stored as HttpOnly cookies. Refresh tokens are stored in the user's `refreshTokens` array in MongoDB to allow revocation.

#### Farms & Plots (`/api/farms/`)

`farmController.js` — All operations verify the requesting user owns the farm (`farm.admin.toString() === req.user._id.toString()`).

- `GET /` — Returns farms where `admin === req.user._id`
- `POST /` — Creates new farm with `admin: req.user._id`
- `GET /:farmId` / `PUT /:farmId` / `DELETE /:farmId` — Standard CRUD with ownership check
- `GET /:farmId/plots` / `POST /:farmId/plots` — List or create plots inside a farm
- `GET/.../plots/:plotId` / `PUT/.../plots/:plotId` / `DELETE/.../plots/:plotId` — Plot CRUD

#### Reports (`/api/reports/`)

`reportController.js` — On create, auto-assigns the next `reportId` (`REP-001`, `REP-002`, ...) by querying the count of existing reports.

Supports lookup by both MongoDB `_id` and `reportId` string. Delete cascades (removes image references). PDF download triggers `pdfService.generateReportPDF()`.

#### Diseases (`/api/diseases/`)

`diseaseController.js` — Create/update support multipart file upload (`multer` in-memory) which then gets pushed to Cloudinary. Admin-only for mutations; any authenticated user can read.

#### Users (`/api/users/`)

`userController.js` — Profile photo upload: binary buffer from multer → `cloudinaryService.uploadStream()` → returns `public_id` + `secure_url`. On delete, old `public_id` is passed to `cloudinary.uploader.destroy()`.

---

### Middleware (`backend/middleware/`)

**`authMiddleware.js`**

Checks for JWT in two places (in order):
1. `req.cookies.accessToken` (HttpOnly cookie, set by login)
2. `Authorization: Bearer <token>` header

On valid token: attaches `req.user` (decoded payload). On invalid/missing: returns 401. The frontend interceptor handles 401 by calling `/auth/refresh` automatically.

**`roleMiddleware.js`**

Factory: `requireRole('admin')` returns a middleware that checks `req.user.role === 'admin'`, else 403. Used on disease creation routes and user management routes.

**`errorHandler.js`**

Last middleware in the chain. Catches errors thrown anywhere (including async controller errors if wrapped). Returns `{success: false, error: message}`. In development mode it includes the stack trace.

---

### Services (`backend/services/`)

**`emailService.js`** — Wraps SendGrid (primary) with Nodemailer fallback. Used for: registration codes, password reset codes. Sends HTML-formatted emails with the 6-digit code.

**`cloudinaryService.js`** — Wraps `cloudinary.uploader.upload_stream()`. Converts multer buffer to a readable stream and uploads. Returns `{url, public_id}`.

**`pdfService.js`** — Uses a PDF library (PDFKit or similar) to generate disease report PDFs with: report ID, farm name, date, issue, severity badge, description, and Coco-Guard branding.

---

## 5. Frontend

### `frontend/src/main.jsx` — React Entry

Wraps the app with:
```jsx
<ThemeProvider>     ← light/dark mode context
  <AuthProvider>    ← global auth state
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AuthProvider>
</ThemeProvider>
```

### `frontend/src/App.jsx` — Routing

Defines all routes. Public routes (accessible without login) and protected routes (wrapped in `<ProtectedRoute>`):

```
Public:
  /login            → Login.jsx
  /register         → Register.jsx
  /verify-email     → VerifyEmail.jsx
  /forgot-password  → ForgotPassword.jsx
  /reset-password   → ResetPassword.jsx
  /resend           → ResendVerification.jsx
  /about            → AboutUs.jsx
  /diseases         → ManageDiseases.jsx  (read-only public)

Protected (require login):
  /dashboard        → Dashboard.jsx
  /upload           → Upload.jsx
  /analyse-images   → AnalyseImages.jsx
  /farm-map         → FarmMapAnalysis.jsx
  /reports          → Reports.jsx
  /myfarms          → MyFarms.jsx
  /users            → UserManagement.jsx  (admin only)
  /admin            → Admin.jsx
```

`ProtectedRoute.jsx` checks `useAuth().user` — if null, redirects to `/login`.

---

### Context (`frontend/src/context/`)

**`AuthContext.jsx`**

The single source of truth for authentication state. On mount, calls `/auth/me` to hydrate the user object from the session cookie. Exposes:

- `user` — current user object (or null)
- `loading` — true while the initial `/me` call is in flight
- `login(email, password)` → POST `/auth/login` → stores tokens (server sets cookies)
- `register(data)` → POST `/auth/register`
- `confirmRegistration(email, code)` → POST `/auth/register/confirm`
- `logout()` → POST `/auth/logout` → clears local user state
- `forgotPassword(email)` / `forgotConfirm(email, code, password)`
- `verifyEmail(email, code)` — for post-signup verification flow

**`ThemeContext.jsx`**

Provides `isDark` boolean and `toggleTheme()`. Reads/writes to `localStorage`. Applies `dark` class to `document.documentElement` for Tailwind dark mode.

---

### API Layer (`frontend/src/services/`)

**`api.js`** — The central Axios instance

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,   // sends cookies on every request
});
```

**Response interceptor (auto-refresh):**

When any request returns 401:
1. Calls POST `/auth/refresh` once
2. If refresh succeeds → replays all queued failed requests with the new token
3. If refresh fails → clears user state (forces re-login)

This means the user never sees a 401 — expired tokens are handled transparently.

**`farmMapService.js`** — ML API (direct fetch, not axios)

Calls Flask ML API on `http://127.0.0.1:5001` directly from the browser. Uses plain `fetch()` with `FormData` for file uploads:

```js
startFarmMap(videoFile, conf)   → POST /farm-map/start
getFarmMapProgress(sessionId)   → GET  /farm-map/progress/{id}
getFarmMapResult(sessionId)     → GET  /farm-map/result/{id}
analyseTreeDisease(sid, treeId) → POST /farm-map/disease/{id}/{treeId}
```

---

### Pages (`frontend/src/pages/`)

**`Sidebar.jsx`**

Navigation hub for all authenticated pages. Contains:
- **Logo**: "Coco-Guard" in green (#4CAF50)
- **Menu links** (with role gating): Dashboard, Drone Analysis (Upload), Analyse Images, Farm Map, Reports, My Farms
- **Admin-only links**: Add New Disease (ManageDiseases), User Management
- **User section**: Avatar (Cloudinary image or initial letter), username, role badge
- **Logout button**: Confirmation modal → calls `logout()` → redirect to `/login`
- **Theme toggle**: Light/dark switch
- **Mobile**: Hamburger icon (fixed top-left) → slide-in overlay sidebar

**`Login.jsx`**

Standard email + password form. On success, `AuthContext.login()` sets cookies and updates the user state. Redirects to `/dashboard`. Shows password field with show/hide toggle.

**`Register.jsx`**

Two-step flow:
1. Step 1: Fill username, email, password, role → calls `register()` → backend sends code email
2. Step 2: `VerifyEmail.jsx` — enter 6-digit code → calls `confirmRegistration()` → account created, logged in

Password validation: minimum 8 characters, must include uppercase, lowercase, and number.

**`Dashboard.jsx`**

Fetches all reports from `/api/reports` on mount and derives:
- Total unique farms in reports
- Critical alert count (severity HIGH or CRITICAL)
- Reports created in last 7 days
- Health trend (Improving/Declining/Neutral based on severity distribution)

Shows: 4 stat cards + 3 most recent reports with severity badges + a "Farm Overview Map" card linking to `/farm-map`.

**`Upload.jsx`** (called "Drone Analysis" in navigation)

Two tabs:

*Image Upload tab:*
- Drag-and-drop multi-file selector
- Sends each file to ML API `POST /predict`
- Aggregates disease counts and calculates overall health %
- Displays results per image with disease name, confidence, remedy
- "Save Report" button → creates report in backend via `/api/reports`

*Drone Video tab:*
- Single MP4/MOV video file upload
- Sends to ML API `POST /process-drone-video`
- Animated status display while processing
- On completion: shows panorama thumbnail, tree count, disease breakdown per tree
- Result can also be saved as a report

**`AnalyseImages.jsx`** (Two-Stage Detection)

Designed for close-up leaf or aerial images that contain multiple trees:
1. User uploads image(s)
2. Each image → `POST /predict-trees` on ML API
3. ML returns: list of trees detected (each with disease, confidence, bbox, remedy)
4. Renders: image with bounding boxes + sidebar with tree cards
5. Pipeline info chip shows: "Stage 1 — coconut_tree_v6-3.pt → Stage 2 — coconut_disease_v5.pt"
6. Image navigation strip at bottom for multi-file workflows

Disease palette used for bounding boxes:
- Healthy → green
- Black Beetle Attack → red
- Magnesium Deficiency → orange
- Potassium Deficiency → amber
- Yellow Patches → yellow

**`FarmMapAnalysis.jsx`** (Interactive Orthomosaic Viewer)

The most complex frontend page. Handles the full drone farm map pipeline:

1. **Upload**: Video file + confidence threshold slider → `farmMapService.startFarmMap()` → gets `session_id`
2. **Progress polling**: Every ~1.5 seconds → `getFarmMapProgress()` → animated step display (Stitching → Detecting → Segmenting)
3. **Result display** (`MapViewer` sub-component):
   - Draws orthomosaic on HTML5 canvas
   - Overlays colored circles for each detected tree
   - Supports pan (drag) and zoom (scroll/buttons)
   - Click tree circle → calls `analyseTreeDisease()` → shows disease popup
4. **Health ring**: SVG progress ring showing % healthy trees
5. **Tree list**: Scrollable table with all detected trees, health status, and confidence
6. **Marker colors**: Same DISEASE_PALETTE as AnalyseImages

**`MyFarms.jsx`**

Farm management CRUD:
- Lists user's farms with search (by name/location) and sort (name/area/status)
- "Add Farm" modal with optional Leaflet map for GPS coordinate picking
- Expand farm row → shows plots, add/edit/delete plot
- Edit and delete farms with confirmation

**`Reports.jsx`**

Full report management:
- Paginated list (5 per page) with severity color coding
- Stats bar: Total, Critical, Pending counts
- Filters: farm name, date range, issue text
- Create report form (role-gated: admin/agronomist)
- Edit report (inline form), finalize status
- Download PDF: `GET /api/reports/:id/download`
- Preview: opens `ReportPreviewModal` with JSON and PDF preview

**`ManageDiseases.jsx`**

Disease reference library:
- Cards for each disease with name, description, impact, remedy
- Sample images gallery per disease
- Admin users see Add/Edit/Delete controls
- Create disease: multipart form → uploads sample images to Cloudinary via backend
- Public users (non-admin) get read-only view

**`Admin.jsx`**

User profile management with 4 tabs:
- **Profile**: Edit username, bio; upload/remove profile photo (Cloudinary)
- **Security**: Change password with current-password verification
- **Notifications**: Toggle email/SMS preferences (stored in backend)
- **Activity**: Login history, active sessions list

---

## 6. ML API

### `ml/src/app.py` — Flask Server

**Port**: 5001. Runs with `python app.py run`.

On startup, performs a diagnostic check: verifies `coconut_disease_v5.pt` exists, loads it, prints model name, number of classes, and class names. This catches misconfiguration early.

**Singleton model loading** (thread-safe):

```python
_DISEASE_YOLO = None
_DISEASE_YOLO_LOCK = threading.Lock()

def _get_disease_yolo():
    global _DISEASE_YOLO
    if _DISEASE_YOLO is None:
        with _DISEASE_YOLO_LOCK:
            if _DISEASE_YOLO is None:
                _DISEASE_YOLO = YOLO(DISEASE_MODEL_PATH)
    return _DISEASE_YOLO
```

This ensures the model is loaded once on first use and reused across all requests, avoiding expensive re-initialization.

**Disease info**: Loaded from `ml/logs/disease_info.json` at startup. Contains description, impact, and remedy for each of the 4 disease classes plus Healthy.

#### All ML Endpoints

**`GET /health`**
Returns `{status: "ok", yolo_available: true, model_ready: true}`. Used by the frontend to check if the ML service is up.

---

**`POST /predict`** — Single image disease classification

1. Receives image file (multipart)
2. Loads into numpy array
3. Runs `coconut_disease_v5.pt` on the full image
4. Returns highest-confidence detection: `{disease, confidence, image_b64, remedy, description}`
5. If no detections: returns `{disease: "Healthy", confidence: 1.0, ...}`
6. Also returns annotated image as base64 JPEG

---

**`POST /predict-disease`** — Full YOLO segmentation response

Same as `/predict` but returns all detections with their segmentation masks:
`{trees: [{disease, confidence, bbox, mask_points, area}], health_score, annotated_image_b64}`

---

**`POST /predict-trees`** — Two-stage tree + disease detection

This is the core pipeline for the AnalyseImages page:

```
Stage 1: detect_coconut_trees(image)
         ↓ uses coconut_tree_v6-3.pt
         → list of tree bounding boxes

Stage 2: for each tree bbox:
         - crop image (bbox + 10% padding)
         - run _run_yolo_on_crop(crop) with coconut_disease_v5.pt
         - if any detection → take highest confidence disease
         - if no detection → "Healthy"

Fallback: if Stage 1 finds 0 trees
         → treat entire image as single tree
         → run disease detection on full image

Returns: {
  trees: [
    {tree_id, disease, confidence, is_healthy, bbox, remedy, health_score}
  ],
  total_trees, healthy_count, health_score, annotated_image_b64
}
```

---

**`POST /process-drone-images`** — Multi-image stitch + analysis

1. Receives multiple image files
2. Calls `process_panoramic_images()` from `segmentation_enhanced.py` to stitch into panorama and detect tree locations
3. Calls `_classify_trees_yolo(panorama, tree_data, tree_regions)` to run disease detection per tree crop
4. Returns `{panorama_b64, trees, disease_counts, health_score}`

---

**`POST /process-drone-video`** — Drone video full pipeline

1. Saves video to temp file
2. Extracts frames (skipping N frames between samples based on video length)
3. Calls `process_panoramic_images()` to stitch frames into orthomosaic
4. Calls `_classify_trees_yolo()` for disease per tree
5. Returns same format as `/process-drone-images` plus `frame_count`

---

**`POST /farm-map/start`** — Start async farm map job

The heavy-duty pipeline for `FarmMapAnalysis.jsx`:

1. Saves video file to `ml/uploads/farm_map/{session_id}/`
2. Creates job state: `farm_map_jobs[session_id] = {status: 'pending', stage: 'queued', progress: 0}`
3. Submits `_run_farm_map_job(session_id, video_path, conf)` to `ThreadPoolExecutor`
4. Returns `{session_id}` immediately

**`GET /farm-map/progress/<session_id>`** — Poll job status

Returns current job state: `{stage, status, progress (0-100), detail}`. Stages: `stitching`, `detecting_trees`, `segmenting`, `done`, `error`.

**`GET /farm-map/result/<session_id>`** — Fetch completed result

If done: returns `{panorama_b64, trees: [{tree_id, cx_px, cy_px, radius, disease, confidence}], health_score}`.
If still processing: returns 202 with current progress.

**`POST /farm-map/disease/<session_id>/<tree_id>`** — On-demand per-tree disease

When user clicks a tree in the interactive map:
1. Looks up stored tree crop from job data
2. Runs `coconut_disease_v5.pt` on that crop
3. Returns `{disease, confidence, remedy, description}`

---

### `ml/src/yolo_tree_detector.py` — Tree Detection Wrapper

```python
DEFAULT_WEIGHTS = "ml/weights/coconut_tree_v6-3.pt"

def detect_coconut_trees(image, conf=0.35):
    model = _get_cached_model()
    results = model(image, conf=conf)
    # Parse boxes, segments, extract centroids, radii, area, circularity
    return [
        {
          bbox, centroid, radius, confidence, area,
          polygon, circularity, solidity, radial_score
        }
    ]
```

Caches the model globally. Returns rich metadata per detected tree crown, including shape quality metrics (circularity, solidity) useful for filtering false positives.

---

### `ml/src/segmentation_enhanced.py` — Watershed Tree Segmentation

Used in the drone image stitching pipeline to find individual tree crowns in an aerial image:

**`preprocess_for_trees(frame)`**
- Converts to LAB color space
- Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) to L channel only
- Applies bilateral filter (denoises while preserving tree crown edges)
- Returns enhanced BGR image

**`detect_vegetation_mask(frame)`** — Triple-method ensemble
- **HSV**: Hue range 25–85, Saturation > 40, Value > 30
- **ExG** (Excess Green): 2G − R − B thresholded
- **NDVI approx**: (G − R) / (G + R + 1)
- **Majority vote**: pixel is vegetation if ≥ 2 of 3 methods agree
- Returns binary mask

**`segment_individual_trees_watershed(frame, green_mask)`**
- Distance transform on binary mask
- Local maxima → seeds for watershed labels
- Returns list of tree region dicts: `{bbox, centroid, area, mask}`

**`process_panoramic_images(frames)`**
- Stitches input frames into panorama using `stitch_opencv.py`
- Detects vegetation mask on panorama
- Runs watershed segmentation to find individual tree crowns
- Returns `(panorama, tree_data, tree_regions)`

---

### `ml/src/stitch_opencv.py` — Orthomosaic Stitching

Converts a sequence of overlapping drone frames into a single seamless panoramic orthomosaic.

**Two-pass architecture:**

*Pass 1 — Trajectory estimation (fast, low-res):*
- Samples every 2nd frame, resizes to 1280px
- For each consecutive frame pair, tries feature matchers in cascade order until one succeeds:
  1. DISK + LightGlue (GPU-accelerated, best quality)
  2. SuperPoint + LightGlue (GPU, faster)
  3. ORB (CPU, fast baseline)
  4. AKAZE (CPU, scale/rotation robust)
  5. LoFTR (GPU, dense matcher for texture-poor regions)
  6. Phase correlation (last resort, FFT-based)
- Computes homography from matched keypoints → stores transform chain

*Pass 2 — Full-resolution compositing:*
- Re-reads frames at 1920px
- Applies stored transforms to warp each frame onto a shared canvas
- Uses cosine-taper weight masks (centre heavily weighted, edges fade) for seamless blending
- **Best-frame-wins**: where multiple frames overlap, the one with higher central weight wins

**GPU acceleration via `gpu_warp.py`:**
- Converts frame to float32 tensor → CUDA device
- Applies affine warp with bicubic interpolation using `torch.nn.functional.grid_sample`
- Falls back to CPU Lanczos4 if CUDA unavailable
- Also provides `sharpen_gpu()` for post-warp sharpening

---

### `ml/src/map_pipeline.py` — Async Job Orchestration

Manages the farm map pipeline as a background job.

**Job state machine:**
```
pending → stitching → detecting_trees → segmenting → classifying → done
                                                              ↓ (any stage)
                                                            error
```

**Tile-based tree detection on large orthomosaics:**
- Orthomosaics can be 10,000+ pixels wide
- Splits into tiles: `TILE_SIZE=1280`, `OVERLAP=256`
- Runs YOLO on each tile, translates coordinates back to full-image space
- Merges results with NMS (non-maximum suppression) + centroid merge for cross-tile detections

**Thread safety:** `threading.Lock()` protects the `farm_map_jobs` dict. `ThreadPoolExecutor(max_workers=2)` limits concurrent GPU jobs to avoid OOM.

---

### `ml/src/frame_tree_detector.py` — Best-Crop Extractor

After the orthomosaic is built and trees are detected, this module finds the **best quality crop** of each tree from the original video frames (before stitching, so the image is sharp and not warped):

- For each detected tree (by position in orthomosaic), finds which original frames contain that tree
- Scores each candidate crop by:
  - **Sharpness**: Laplacian variance (blurry crops score low)
  - **Centrality**: Trees closer to frame centre score higher (less lens distortion)
- Returns the highest-scoring crop for each tree → fed to disease classification

---

### `ml/src/video_service.py` — Video Frame Extraction

**`VideoAnalyzer` class:**
- `extract_frames_from_video(path, skip=N)`: Opens video with OpenCV, reads every Nth frame, returns list of BGR numpy arrays
- Skip interval is adaptive: short videos sample more densely; long videos skip more to avoid thousands of frames
- `analyze_video(path)`: Runs disease detection on sampled frames, aggregates statistics (disease histogram, health % over time)

---

### `ml/logs/disease_info.json` — Disease Knowledge Base

Loaded at startup by `app.py`. Maps each disease class name to:

```json
{
  "Black Beetle Attack": {
    "description": "Rhinoceros beetle causes V-shaped cuts on emerging fronds...",
    "impact": "Severe infestation can kill the growing point...",
    "remedy": "Apply systemic insecticides (chlorpyrifos)..."
  },
  ...
  "Healthy": {
    "description": "No visible signs of disease or nutrient deficiency.",
    "impact": "No adverse effects detected.",
    "remedy": "No treatment needed. Continue regular monitoring..."
  }
}
```

This is included in every disease detection response so the frontend always has the full medical context without a second lookup.

---

## 7. ML Model Training

### The Models

**`coconut_tree_v6-3.pt`** — Tree crown detector

Trained to detect individual coconut tree crowns from aerial/drone imagery. The `v6-3` suffix indicates this is version 6, run 3 — the best checkpoint from iterative training. Architecture: YOLOv8 instance segmentation (detects bounding boxes + pixel masks). Single class: `coconut_tree`.

**`coconut_disease_v5.pt`** — Leaf disease detector

Trained on close-up coconut leaf images with 4 disease classes. `v5` is the production version. Architecture: YOLOv8 instance segmentation. Used both for whole-image prediction and per-tree crop analysis.

---

### Training Pipeline (`ml/training/train_disease_yolo.py`)

This script automates the full training workflow in 3 stages:

**Stage 1 — `prepare_dataset()`**

Expects annotated images and YOLO-format label files:
```
ml/annotated/
  images/   ← image files (.jpg, .png)
  labels/   ← YOLO label files (.txt, one per image)
             ← format: class_id cx cy w h (normalized 0-1)
```

Calls `dataset_generator.create_dataset_splits()` to split into train/val/test (80/10/10 ratio) and generates a `dataset.yaml`:

```yaml
path: ml/coconut_dataset
train: train/images
val: val/images
test: test/images
nc: 4
names: [Black Beetle Attack, Magnesium Deficiency, Potassium Deficiency, Yellow Patches]
```

**Stage 2 — `train_model()`**

```python
model = YOLO("yolov8n-seg.pt")   # start from YOLOv8 nano pretrained weights
model.train(
    data="coconut_dataset/dataset.yaml",
    epochs=50,
    imgsz=1024,
    batch=4,
    patience=10,     # early stopping
    device="0",      # GPU 0 (falls back to "cpu")
    project="ml/runs/segment",
    name="coconut_training",
)
```

YOLO training uses transfer learning: the pretrained `yolov8n-seg.pt` backbone (trained on COCO dataset) is fine-tuned on the coconut disease dataset. The small batch size (4) and high image size (1024) are suitable for high-resolution leaf images.

**Stage 3 — `deploy_model()`**

```python
# Copy best checkpoint to production weights
shutil.copy(
    "ml/runs/segment/coconut_training/weights/best.pt",
    "ml/weights/coconut_disease_v5.pt"
)
```

YOLO saves `best.pt` (best validation mAP checkpoint) and `last.pt`. Only `best.pt` is deployed.

---

### Annotation Workflow (`ml/src/auto_annotate.py`)

An interactive desktop tool for labeling raw images:

1. Place raw images in `ml/data/raw/`
2. Run the script: it opens each image in an OpenCV window
3. The YOLO disease model (`coconut_disease_v5.pt`) auto-suggests a class label
4. User draws a bounding box by click-dragging
5. Keys: `ENTER` = accept prediction, `0-3` = override to specific class, `S` = skip, `Q` = quit
6. Confirmation dialog before saving
7. Saves annotated image to `ml/data/original/<class_name>/` with bounding box drawn
8. Maintains `annotation.json` per class folder with bbox coordinates

The workflow then continues to YOLO labeling format conversion and `split_dataset.py` before training.

---

### Model Evaluation (`ml/src/evaluate_model.py`)

Evaluates model performance on the held-out test set. Reports:
- Per-class accuracy, precision, recall, F1
- Confusion matrix
- Overall accuracy vs 92% target threshold
- Average confidence for correct vs incorrect predictions

Saves results to `ml/evaluation_results.json`.

---

## 8. Key Data Flows

### Registration & Login

```
1. User fills Register form (username, email, password, role)
   → POST /api/auth/register
   → Backend creates PendingUser (hashed password, 6-digit code)
   → emailService sends code to email

2. User enters code on VerifyEmail page
   → POST /api/auth/register/confirm
   → Backend: verify code & expiry, create User, delete PendingUser
   → Signs access token (15m) + refresh token (7d)
   → Sets both as HttpOnly cookies

3. Subsequent requests:
   → Cookie sent automatically (withCredentials: true)
   → authMiddleware decodes JWT, attaches req.user
   → If 401 received → Axios interceptor calls /auth/refresh automatically
```

### Two-Stage Disease Detection (`/analyse-images`)

```
User uploads image → AnalyseImages.jsx
  → POST /predict-trees to ML API (port 5001)
    Stage 1: YOLO coconut_tree_v6-3.pt runs on full image
             → detects N tree bounding boxes
    Stage 2: for each tree:
               crop = image[y1-pad : y2+pad, x1-pad : x2+pad]
               result = coconut_disease_v5.pt(crop)
               if detections: disease = highest confidence
               else: disease = "Healthy"
    Fallback: if N=0 trees detected → run disease on full image
    Returns: trees list with disease + bbox + remedy + confidence
  ← Frontend renders: annotated image + disease cards per tree
```

### Drone Farm Map Pipeline (`/farm-map`)

```
User uploads drone video → FarmMapAnalysis.jsx
  → farmMapService.startFarmMap(video) → POST /farm-map/start
    ML API: save video → start background job → return session_id

  Frontend polls GET /farm-map/progress/{session_id} every 1.5s
    Stage 1 (Stitching):
      stitch_opencv.py: extract frames → cascade feature matching
        → build transform chain → warp onto shared canvas
        → cosine-taper blending → orthomosaic PNG

    Stage 2 (Tree Detection):
      frame_tree_detector.py: tile orthomosaic → YOLO on each tile
        → merge tile detections → NMS → tree list with (cx, cy, radius)

    Stage 3 (Disease Classification):
      For each tree: extract best-quality crop from source frames
        → run coconut_disease_v5.pt → store disease result
    
    Job state: { progress: 100, stage: "done" }

  Frontend: GET /farm-map/result/{session_id}
    ← panorama_b64 + trees list

  Renders: MapViewer (HTML5 canvas)
    → draws orthomosaic
    → overlays colored circles at (cx_px, cy_px) for each tree
    → user clicks circle → POST /farm-map/disease/{id}/{tree_id}
    ← disease name, confidence, remedy → show in popup
```

### Report Generation

```
1. After disease analysis (Upload or AnalyseImages page)
   User clicks "Save Report"
   → POST /api/reports
     { farm, issue, severity, description, date }
   Backend: auto-assign reportId (REP-001, REP-002, ...)

2. View report in Reports page
   → GET /api/reports → list with pagination

3. Download PDF
   → GET /api/reports/:id/download
   → pdfService.generateReportPDF() → binary stream response
   → Browser downloads as .pdf

4. Finalize report
   → PUT /api/reports/:id { status: "Finalized" }
```

---

## 9. Configuration & Environment

### `backend/.env`

```env
MONGODB_URI=mongodb://localhost:27017/coconut_disease_db
JWT_SECRET=<your-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>
PORT=5000
CLIENT_URL=http://localhost:5173

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@yourdomain.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_ML_URL=http://127.0.0.1:5001
```

### `ml/src/config.yaml`

```yaml
image_size: 300          # Used by legacy training utilities
batch_size: 16
learning_rate: 0.0001
num_epochs: 30
early_stopping_patience: 12
model_name: efficientnet_b3   # Legacy reference only
device: cuda
class_names:
  - Black Beetle Attack
  - Magnesium Deficiency
  - Potassium Deficiency
  - Yellow Patches
```

### `.gitignore` — What is NOT committed

- Model weights: `*.pt`, `*.pth`, `*.onnx` — too large for git
- ML datasets: `ml/data/`, `ml/datasets/`, `ml/coconut_dataset/`
- ML training runs: `ml/runs/`
- Farm map job uploads: `ml/farm_map_jobs/`, `ml/uploads/`
- Environment files: `.env` (all)
- Python virtualenv: `.venv/`
- Node packages: `node_modules/`

---

## 10. Docker Deployment

`docker-compose.yml` defines four services:

| Service | Port | Description |
|---|---|---|
| `frontend` | 3000 | Vite dev server (or built static files) |
| `backend` | 5000 | Node.js Express API |
| `mongo` | 27017 | MongoDB database |
| `ai_api` | 5001 | Flask ML server (from `ml/ai_api/`) |

Start all services:
```bash
docker-compose up --build
```

For local development without Docker, start each service individually (see `RUN_GUIDE.md`):
- Backend: `npm run dev` in `backend/`
- ML API: `python app.py run` in `ml/src/`
- Frontend: `npm run dev` in `frontend/`

---

## Port Summary

| Service | Port |
|---|---|
| Frontend (Vite) | 5173 (dev) / 3000 (Docker) |
| Backend (Express) | 5000 |
| ML API (Flask) | 5001 |
| MongoDB | 27017 |
