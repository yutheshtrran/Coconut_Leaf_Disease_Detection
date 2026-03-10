# Project Execution Guide (yuthee_dev Branch)

This guide explains how to run the integrated components of the Coconut Leaf Disease Detection application on the `yuthee_dev` branch.

## 1. Backend Service (Node.js)
The backend manages the database, authentication, and logic.

- **Directory**: `backend/`
- **Execution**:
  ```powershell
  cd backend
  npm run dev
  ```
- **Port**: Runs on `http://localhost:5000` (Swapped back to default)
- **Environment**: Configured via `backend/.env`.

## 2. ML Pipeline (Flask/Python)
The ML service handles disease detection, video analysis, and drone image stitching.

- **Directory**: `ml/src/`
- **Execution**:
  ```powershell
  # Activate your virtual environment first
  & "d:/M3 Projects/Coconut_Leaf_Disease_Detection/.venv/Scripts/Activate.ps1"
  cd ml/src
  python app.py run
  ```
- **Port**: Runs on `http://localhost:5001` (Swapped to avoid conflict with Backend)
- **Features**: 
    - ✅ Image Analysis (`/predict`)
    - ✅ Video Analysis (`/analyze-video`)
    - ✅ Drone Stitching & Tree Counting (`/process-drone-images`)

## 3. Frontend Application (Vite/React)
The user interface for plantation management and analysis.

- **Directory**: `frontend/`
- **Execution**:
  ```powershell
  cd frontend
  npm run dev
  ```
- **Port**: Runs on `http://localhost:5173`
- **Configuration**: Points to backend at `http://localhost:5000/api`.

---

## Integrated Analysis Status

### ✅ Image & Video Upload
- **Status**: Operational on `yuthee_dev`.
- **How to use**: Use the "Upload" page in the frontend to upload single images, multiple images, or video files.

### ✅ Drone Plantation Analysis
- **Status**: Operational on `yuthee_dev`.
- **How to use**: Select **2 or more** drone images in the Upload section and click **"Process Drone Images"**. 
- **Output**: Generates a stitched panorama, detects trees with red circles, and provides a health/count report.

### ⚙️ Port Configuration Note
- **Backend**: Port `5000`
- **ML API**: Port `5001`
- **Frontend**: Port `5173`
- Ensure no other services are occupying these ports before starting.
