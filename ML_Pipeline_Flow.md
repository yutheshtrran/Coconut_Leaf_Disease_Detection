# Coconut Leaf Disease Detection: ML Pipeline Flow

## 1. Frontend to ML Backend Connection
The frontend file `AnalyseImages.jsx` connects to the ML backend through a simple REST API approach.
- When an image is uploaded via the drag-and-drop or file selector, it makes a `POST` request to `http://127.0.0.1:5000/predict` (served by `ml/app.py`).
- The image data is sent as a `FormData` object with the key `"file"`.
- The ML backend (`app.py`) utilizes the `infer()` method from `src/inference.py` to run the active model (loaded from `weights/best_model.pth`).
- The API responds with JSON containing the predicted `disease`, `confidence`, `severity_level`, and `remedy`.
- The frontend then renders these JSON fields on the UI, using color coding for severity and confidence bars.

---

## 2. ML Folder Structure

```text
d:\FYP_CG\Coconut_Leaf_Disease_Detection\ml\
├── ai_api/                 # API wrapper functions and Docker setup
├── data/                   # Dataset storage (raw, processed)
├── notebooks/              # Jupyter notebooks for experimentation and EDA
├── reports/                # Output analysis or metrics reports
├── src/                    # Core pipeline and model implementation code
│   ├── app.py              # Main Flask server
│   ├── video_service.py    # Video frame extraction and analysis
│   ├── drone_pipeline.py   # Standard drone image stitching & detection
│   ├── drone_pipeline_enhanced.py # Enhanced stitching and detection with Pre-processing
│   ├── segmentation.py     # Tree segmenter & inference
│   ├── inference.py        # Object inference using standard trained models
│   ├── tree_detector.py    # Locates coconut trees
│   └── ...                 # Other utilities (metrics, geo_utils, training, etc.)
├── uploads/                # Directory for user uploaded images
├── videoframes/            # Output folder for extracted video frames
├── weights/                # Model weights (best_model.pth, yolov8n-seg.pt, etc.)
├── app.py                  # API server startup wrapper
├── config.yaml             # Configuration for classes and model parameters
└── ...                     # READMEs and requirements.txt
```

---

## 3. Video and Frame Extraction Flow
Handled primarily within `ml/src/video_service.py`.

1. **Video Ingestion:** Uses `cv2.VideoCapture` to load the video file.
2. **Frame Skipping:** To optimize speed, the analyzer uses a `frame_skip` parameter (e.g., processes only every 5th frame).
3. **Extraction:** Loops through the video, reads valid frames, skips the specified amount, and appends the frame to a list until `max_frames` is reached or the video ends.
4. **Segmentation per Frame:** Each extracted frame is passed to `TreeSegmenter` (from `segmentation.py`). The segmenter detects the trees in that specific frame, calculating:
   - Number of trees found
   - Tree health percentage and disease classification breakdown
   - Coordinates (centroids) of detected trees
   - Farm size approximation
5. **Aggregation:** The module aggregates these statistics across all processed frames (average tree counts, maximum trees in a frame, total disease percentage).
6. **Output:** It returns a dictionary of the aggregated statistics and optionally saves annotated frames to the `videoframes/` directory.

---

## 4. Drone Image Panoramic Stitching
Handled by `ml/src/drone_pipeline_enhanced.py` or `ml/src/drone_pipeline.py`.

1. **Ingestion & Resizing:** Loads multiple high-resolution drone images with a generous overlap (ideally 30-50%). If the width exceeds 2000px, the image is resized using a Lanczos interpolation to maintain quality while reducing processing time.
2. **Panoramic Stitching:**
   - Initializes `cv2.Stitcher_create` in `PANORAMA` mode.
   - If `PANORAMA` stitching fails safely, it aggressively falls back to the `SCANS` mode.
3. **Pre-processing (Enhanced Pipeline):**
   - Applies a Bilateral Filter for edge-preserving noise reduction.
   - Converts to LAB color space and applies CLAHE (Contrast Limited Adaptive Histogram Equalization) on the Lightness, A, and B channels independently to handle lighting variations and shadows.
   - Merges channels, converts back to BGR, and applies an Unsharp Mask (Gaussian blur subtraction) alongside a sharpening kernel for crisp detail enhancement.

---

## 5. Tree Finding and Counting Flow
Follows the stitching within the drone pipeline script.

1. **Detection (YOLOv8):** The optimized stitched panorama image is passed into an Ultralytics YOLOv8 segmentation model (e.g., `yolov8m-seg.pt`). It predicts bounding boxes, confidence score, and classes for "Coconut Tree."
2. **Soft Non-Maximum Suppression (Soft-NMS):** Rather than strictly eliminating overlapping bounding boxes (standard NMS), Soft-NMS scales down the confidence of overlapping detections dynamically based on IoU (Intersection over Union). This preserves trees that happen to grow very close to one another without double-counting.
3. **Advanced Filtering:**
   - Filters out extreme confidence thresholds (`< 0.35`).
   - Filters by geometric pixel area (`> 800 px`) to ignore tiny artifacts.
   - Checks the Aspect Ratio of the bounding box (width/height) to ensure it's not radically stretched (keeps values between `0.3` and `3.0`).
4. **Annotation and Counting:**
   - Loops over the final filtered valid tree dictionaries.
   - Annotates the visual panorama bounding box directly using distinct label colors for high, medium, and low confidences. 
   - Assigns a unique `tree_id` ("Tree_1", "Tree_2", etc.) yielding the exact tree count.
5. **Data Output:** 
   - Writes the total metrics and exact positional tree JSON schema to standard output.
   - Saves `panorama.jpg`, `annotated_trees.jpg`, `tree_data.csv`, and `tree_data.json` into the specified results folder.
