# Report Generation & Farm Management — Task List

**45 tasks · 7 areas · ~22.5 hours estimated**

> GPS confirmed from `DJI_20260304151321_0142_D.MP4`: **6.805303°N, 79.966913°E** (Homagama, Sri Lanka)
> Encoded as IEEE-754 doubles in radians inside the `djmd` protobuf stream — 3,906 points at 60fps.

---

## Area 1 — Farm Backend

### New Files

- [x] **Create Farm Mongoose model** `backend/models/Farm.js` *(20 min)*
  - `name` — String, required, unique, trimmed
  - `location` — `{ lat: Number, lon: Number }` required
  - `address` — String (reverse-geocoded from Nominatim, stored on save)
  - `areaHectares` — Number, optional
  - `createdBy` — ObjectId ref User
  - `createdAt`, `updatedAt` — timestamps: true

- [x] **Create Farm controller** `backend/controllers/farmController.js` *(40 min)*
  - `getFarms` — GET all, supports `?search=name` for dropdown autocomplete
  - `createFarm` — POST, admin/agronomist only, auto-reverse-geocodes via Nominatim if address not provided
  - `updateFarm` — PUT, admin/agronomist only
  - `deleteFarm` — DELETE, admin only

- [x] **Create Farm routes and register on Express** `backend/routes/farmRoutes.js` *(20 min)*
  - `GET /api/farms`, `POST /api/farms`, `PUT /api/farms/:id`, `DELETE /api/farms/:id`
  - Mount in `backend/src/index.js` at `/api/farms`

- [x] **Add Nominatim reverse-geocode helper** `backend/utils/geocode.js` *(20 min)*
  - `reverseGeocode(lat, lon)` — calls `https://nominatim.openstreetmap.org/reverse?format=json&lat=&lon=`
  - Returns `display_name` string
  - Must include `User-Agent` header (Nominatim policy requirement)

- [x] **Create frontend Farm service** `frontend/src/services/farmService.js` *(20 min)*
  - `fetchFarms(search?)`, `createFarm(data)`, `updateFarm(id, data)`, `deleteFarm(id)`
  - Axios-based, same auth header pattern as other services

### Edits

- [x] **Link Report model to Farm** `backend/models/Report.js` *(15 min)*
  - Replace `farm: String` with `farmId: ObjectId ref Farm`
  - Keep `farm: String` as denormalised display fallback (populated on save)

---

## Area 2 — Report Backend

- [x] **Add analysisData sub-schema to Report model** `backend/models/Report.js` *(20 min)*
  - `analysisType` — enum `'leaf' | 'drone-image' | 'drone-video'`
  - `totalImages` — Number
  - `healthyPercent` — Number
  - `diseases` — Array of `{ name, count, percentage, topConfidence, description, remedy }`
  - `treeSummary` — `{ total, healthy, atRisk }` (drone types only)
  - `annotatedImages` — `[String]` base64 data URIs, max 3 (validated in controller)
  - `gps` — `{ lat, lon, source: 'video' | 'manual' | 'farm' }`

- [x] **Update createReport to persist analysisData** `backend/controllers/reportController.js` *(30 min)*
  - Accept `analysisData`, `farmId`, `gps` from request body
  - If `farmId` provided, populate `farm` string from it
  - Cap `annotatedImages` at 3 entries server-side
  - Auto-derive `issue` and `severity` from `analysisData.diseases[0]` if not explicitly supplied

- [x] **Update previewReport to return analysisData + farm location** `backend/controllers/reportController.js` *(20 min)*
  - Populate `farmId` so lat/lon is available in response
  - Include full `analysisData` in the JSON response

- [ ] **Enhance pdfkit PDF download** `backend/controllers/reportController.js` *(45 min)*
  - Add **Farm Location** section: name, address, lat/lon
  - Add **Disease Breakdown** table: Disease | Detections (%) | Confidence | Severity
  - Add **Recovery Tips** as numbered paragraphs from `diseases[].remedy`
  - Embed first annotated image as JPEG thumbnail via `pdfkit image(Buffer.from(b64, 'base64'))`

- [ ] **Update reportService.js and wire into Reports.jsx** `frontend/src/services/reportService.js` *(30 min)*
  - Add `previewReport(id)` export
  - Update `createReport(data)` to accept extended payload
  - Replace inline fetch duplications in `Reports.jsx` with service calls

---

## Area 3 — ML GPS Extractor

> **Extraction method (confirmed working):**
> Scan `djmd` stream for pattern `0x0A 0x12 0x11` + byte `0x19` at offset +11.
> Read 8 bytes at +3 as little-endian double (lat radians), 8 bytes at +12 as little-endian double (lon radians).
> Convert: `lat_deg = math.degrees(lat_rad)`. Validate ±90/±180. Average all valid points.

- [x] **Create gps_extractor.py** `ml/src/gps_extractor.py` *(40 min)*
  - `extract_dji_gps(video_path)` — extracts `djmd` stream via `ffmpeg -map 0:1` subprocess
  - Scans for protobuf GPS pattern, returns `{ lat, lon, point_count, source: 'djmd' }` or `None`
  - Filters invalid readings (abs(lat) > 90 or abs(lon) > 180) before averaging
  - Fails gracefully if ffmpeg unavailable or stream empty — never raises

- [x] **Add POST /extract-gps endpoint** `ml/src/app.py` *(20 min)*
  - Accepts video file upload, saves temporarily, calls `extract_dji_gps()`, deletes file
  - Returns `{ success, lat, lon, point_count }` or `{ success: false }`

- [x] **Auto-extract GPS during farm-map/start** `ml/src/app.py` *(15 min)*
  - After saving video and starting pipeline thread, spawn GPS thread concurrently (see Area 7)
  - Store result in `farm_map_jobs[sid]['gps']` when thread finishes

- [x] **Return GPS in farm-map/result response** `ml/src/app.py` *(10 min)*
  - Include `gps: { lat, lon, point_count }` (or `null`) alongside `tree_count` and `map_b64`

---

## Area 4 — GenerateReportModal + Map Picker

### Map infrastructure

- [ ] **Install Leaflet** *(10 min)*
  - `npm install leaflet react-leaflet` in `frontend/`
  - Import Leaflet CSS in `main.jsx`
  - No API key needed — OpenStreetMap tiles are free and key-free

- [ ] **Build FarmLocationPicker component** `frontend/src/components/FarmLocationPicker.jsx` *(1.5 h)*
  - react-leaflet `MapContainer` with OpenStreetMap tiles, default zoom 14, centered on Sri Lanka (~7.87°N 80.77°E)
  - Click-to-pin: clicking places a draggable marker; dragging updates coordinates
  - **"Use detected GPS" button** — only shown when `detectedGps` prop is non-null; clicks pins and pans map to those coords
  - Nominatim reverse geocode on pin placement (debounced 500ms) — updates address display below map
  - Emits `onChange({ lat, lon, address })` to parent

### Farm name combobox

- [ ] **Build FarmCombobox component** `frontend/src/components/FarmCombobox.jsx` *(1 h)*
  - Text input filtering existing farms from `GET /api/farms?search=query` (debounced 300ms)
  - Selecting an existing farm pre-fills map location in parent
  - Typing an unknown name shows **"+ Create new farm: [name]"** at bottom of dropdown
  - Keyboard navigation: arrow keys, Enter, Escape

### Main modal

- [ ] **Build GenerateReportModal** `frontend/src/components/GenerateReportModal.jsx` *(2 h)*
  - **Props**: `{ open, onClose, analysisType, analysisData, detectedGps }`
  - **Section 1 — Summary preview**: read-only cards — top disease, confidence, image/tree count, healthy%
  - **Section 2 — Farm**: `FarmCombobox` for farm name; selecting existing pre-fills map
  - **Section 3 — Location**: `FarmLocationPicker` with `detectedGps` passed in; banner shown when GPS detected from video
  - **Section 4 — Details**: Assessment Date (defaults today), Notes textarea
  - **Save flow**: if new farm → `POST /api/farms` first, then `POST /api/reports` with full `analysisData` and `farmId`. On success → call `onReportSaved(reportId)`
  - Validation: farm name required, location required (must have pinned a point)

- [ ] **Handle GPS pre-extraction in drone video flows** *(20 min)*
  - Store `gps` from farm-map result (or job context) in component state
  - Pass as `detectedGps` to `GenerateReportModal`
  - `detectedGps = null` for leaf image flows (single images carry no GPS)

- [ ] **Build analysisData payload builders** `frontend/src/utils/buildAnalysisData.js` *(40 min)*
  - `buildLeafAnalysisData(results[])` — disease counts, healthy%, annotated images (max 3)
  - `buildDroneImageAnalysisData(diResults[])` — tree counts, disease breakdown, annotated images
  - `buildDroneVideoAnalysisData(trees[], counts)` — tree summary, disease breakdown from tree list

---

## Area 5 — Wire Generate Report Into Analysis Pages

### AnalyseImages.jsx

- [ ] **Add "Generate Report" button to results panel** `frontend/src/pages/AnalyseImages.jsx` *(25 min)*
  - Show when `results.length > 0`
  - On click: call `buildLeafAnalysisData(results)`, set `showReportModal = true`
  - `detectedGps` is always `null` here

- [ ] **Mount GenerateReportModal and ReportPreviewModal** `frontend/src/pages/AnalyseImages.jsx` *(15 min)*
  - Add modal state: `showReportModal`, `previewReportId`
  - On `onReportSaved(id)`: close report modal, open preview modal

### Upload.jsx — drone-images tab

- [ ] **Add Generate Report to drone-images tab** `frontend/src/pages/Upload.jsx` *(30 min)*
  - Show button after `diResults` populated
  - Call `buildDroneImageAnalysisData(diResults)`, open modal
  - Attempt GPS via `POST /extract-gps` when file selected; `detectedGps = null` if unavailable

### FarmMapAnalysis.jsx — drone video

- [ ] **Store gps from farm-map result** `frontend/src/pages/FarmMapAnalysis.jsx` *(10 min)*
  - Destructure `gps` from farm-map result JSON response
  - Store in `detectedGps` state variable

- [ ] **Add Generate Report to FarmMapAnalysis results panel** `frontend/src/pages/FarmMapAnalysis.jsx` *(30 min)*
  - Show button when pipeline `status === 'done'`
  - Pass `detectedGps` to `GenerateReportModal`
  - Call `buildDroneVideoAnalysisData(trees, counts)`

---

## Area 6 — Enhanced ReportPreviewModal

> All new sections are **conditionally rendered** — backward compatible with existing reports that have no `analysisData`.

- [ ] **Add Farm & Location section** `frontend/src/components/ReportPreviewModal.jsx` *(45 min)*
  - Show when `report.farmId?.location` is present
  - Render: farm name, address, and static map image via OpenStreetMap static API:
    `https://staticmap.openstreetmap.de/staticmap.php?center={lat},{lon}&zoom=16&size=600x300&markers={lat},{lon},red-pushpin`
  - Use **inline styles only** (not Tailwind) — html2pdf requires this inside the capture target

- [ ] **Add Analysis Summary bar** `frontend/src/components/ReportPreviewModal.jsx` *(25 min)*
  - Three chips: Total Images/Trees, Healthy %, Diseases Found
  - Drone types also show: At Risk count from `treeSummary.atRisk`

- [ ] **Add Disease Breakdown cards** `frontend/src/components/ReportPreviewModal.jsx` *(30 min)*
  - One card per `analysisData.diseases[]` entry
  - Confidence bar, % affected, description paragraph
  - Sorted by `topConfidence` descending; first card gets "Primary Concern" label

- [ ] **Add Recovery Tips section** `frontend/src/components/ReportPreviewModal.jsx` *(20 min)*
  - Numbered steps from `diseases[].remedy`, grouped by disease name

- [ ] **Add Annotated Images thumbnail grid** `frontend/src/components/ReportPreviewModal.jsx` *(20 min)*
  - 2-column grid of `<img src={b64}>` from `analysisData.annotatedImages[]`
  - `max-height: 280px; object-fit: contain` to avoid PDF overflow

- [ ] **Add Drone Orthomosaic thumbnail** `frontend/src/components/ReportPreviewModal.jsx` *(15 min)*
  - Only for `analysisType === 'drone-video'`
  - Full-width, captioned "Farm Overview Map", above disease cards

- [ ] **Test html2pdf capture** *(30 min)*
  - Verify static map image renders in pdf — if OSM URL blocked by html2pdf CORS, pre-fetch as blob and convert to base64 data URI before rendering

---

## Area 7 — Parallel GPS Extraction & Background Job Persistence

### ML — parallel GPS thread

- [ ] **Launch GPS extraction as a concurrent thread in farm_map_start()** `ml/src/app.py` *(25 min)*
  - Spawn `threading.Thread(target=_run_gps_extraction, args=(sid, video_path), daemon=True).start()` immediately after the pipeline thread
  - `_run_gps_extraction` writes `farm_map_jobs[sid]['gps']` when done
  - Set `farm_map_jobs[sid]['gps_status'] = 'extracting'` → `'done'` or `'unavailable'`
  - GPS thread reads only — does not delete the video file (pipeline thread owns file lifecycle)

- [ ] **Include gps_status and gps in the progress endpoint** `ml/src/app.py` *(15 min)*
  - `farm_map_progress()` returns `gps_status: 'extracting' | 'done' | 'unavailable'`
  - Returns `gps: { lat, lon, point_count }` or `null` as soon as GPS thread finishes
  - Frontend can pre-fill map picker from GPS long before pipeline completes

### Frontend — global job context

- [ ] **Create JobContext — global background job manager** `frontend/src/context/JobContext.jsx` *(1.5 h)*
  - **State**: `jobs: Map<sessionId, JobRecord>` where `JobRecord = { sessionId, farmName, status, progress, stage, detail, gps, gpsStatus, startedAt, notified }`
  - **On mount**: reads `localStorage.getItem('bgJobs')` to restore in-flight jobs across page reloads; filters out jobs older than 24 hours
  - **Polling loop**: single `setInterval` (3s tick) at context level polls `GET /farm-map/progress/:sid` for all active jobs — never unmounts on navigation
  - **On done/error**: update job, call `triggerNotification(job)`, move to completed
  - **On gps_status → done**: update `job.gps` in state so pages can subscribe immediately
  - **Exports**: `{ jobs, startJob(sid, farmName), getJob(sid), clearJob(sid) }` via `useJobContext()` hook

- [ ] **Mount JobContext in App.jsx above all routes** `frontend/src/App.jsx` *(5 min)*
  - Wrap `<AppWrapper>` with `<JobProvider>` inside `<ThemeProvider>`
  - Must live above the router so it survives page transitions

- [ ] **Persist job state to localStorage on every update** *(inside JobContext)* *(20 min)*
  - `useEffect` on `jobs` → `localStorage.setItem('bgJobs', JSON.stringify([...jobs.values()]))`
  - Clear a job's entry when user explicitly dismisses it

### Frontend — notification system

- [ ] **Build JobStatusBadge** `frontend/src/components/JobStatusBadge.jsx` *(1.5 h)*
  - Rendered inside `Sidebar.jsx`, pinned above bottom nav items
  - **Active job**: pulsing green dot + "Analysis running…" + mini progress bar
  - **Job complete**: "Analysis complete ✓" + **"View Results"** button → navigate to results page with session ID in query params
  - **Job error**: red dot + "Analysis failed" + "Retry" link
  - **Click to expand**: dropdown listing all jobs with farm name, progress %, status
  - Hidden when no tracked jobs exist

- [ ] **Add JobStatusBadge to Sidebar** `frontend/src/components/Sidebar.jsx` *(10 min)*
  - Import and render `<JobStatusBadge />` inside the sidebar
  - No other layout changes

- [ ] **Browser Notifications API integration** *(inside JobContext)* *(30 min)*
  - On first job ever started: call `Notification.requestPermission()`, store result
  - On job complete with permission granted: `new Notification('Farm Map Ready', { body: '...', icon: '/logo.png' })`
  - Clicking browser notification: `window.focus()` + navigate to results page
  - If permission denied: fall back to in-app `Toast.jsx`

### Frontend — page-level integration

- [ ] **Update FarmMapAnalysis to use JobContext** `frontend/src/pages/FarmMapAnalysis.jsx` *(45 min)*
  - After `POST /farm-map/start`: call `startJob(sid, farmName)` — context takes over polling
  - **On page mount**: check `useJobContext().jobs` for existing active/completed drone-video jobs; show banner: *"You have a farm analysis in progress — click to load results"*
  - Read `job.gps` from context (may arrive early via parallel GPS thread)

- [ ] **Handle deep-link navigation from notification** `frontend/src/pages/FarmMapAnalysis.jsx` *(40 min)*
  - Route: `/farm-map-analysis?session=<sid>`
  - On mount, read query param → find completed job in context or fetch from `/farm-map/result/:sid`
  - Skip upload step and render results directly

---

## Summary

| Area | Tasks | New Files | Est. Time |
|---|---|---|---|
| Farm Backend | 6 | `Farm.js`, `farmController.js`, `farmRoutes.js`, `geocode.js`, `farmService.js` | ~2 h |
| Report Backend | 5 | — | ~2.5 h |
| ML GPS Extractor | 4 | `gps_extractor.py` | ~1.5 h |
| Report Modal + Map | 7 | `GenerateReportModal.jsx`, `FarmLocationPicker.jsx`, `FarmCombobox.jsx`, `buildAnalysisData.js` | ~6 h |
| Analysis Pages | 6 | — | ~1.75 h |
| Report Preview | 7 | — | ~3 h |
| Background Jobs + GPS | 10 | `JobContext.jsx`, `JobStatusBadge.jsx` | ~5.5 h |
| **Total** | **45** | **12 new files** | **~22.5 h** |
