# YOLO Segmentation: Complete Workflow Guide

This guide covers how to run the preprocessing scripts, annotate your dataset, and train/save your YOLO model for coconut crown detection.

---

## 1. How to Run (Pre-processing)

High-resolution drone images are too large for YOLO to process directly. We must slice them into 1024x1024 chunks first.

1. **Prepare Folders**: Create a folder for your raw, un-sliced drone images (e.g., `ml/data/raw/drone_images`).
2. **Place Images**: Put your DJI Drone `JPG` images inside this folder.
3. **Run the Slicer**:
   Open your terminal in the `ml` directory and run:
   ```bash
   python scripts/split_drone_images.py --input data/raw/drone_images --output coconut_dataset/images_to_label
   ```
   *This will generate hundreds of smaller `1024x1024` image tiles in the `images_to_label` folder.*

---

## 2. How to Annotate (Labeling)

We highly recommend using **Roboflow** (Free & easy to use) or **CVAT** for drawing polygon masks.

1. **Create a Project**: Go to [roboflow.com](https://roboflow.com), create an account, and create a new project. 
   - **Project Type**: `Instance Segmentation` (Polygon).
   - **Annotation Group**: `coconut_tree`
2. **Upload Images**: Drag and drop all the tiles from `coconut_dataset/images_to_label` into Roboflow.
3. **Define Classes**: Add your 4 classes: `coconut_tree`, `banana`, `bush`, `other_tree`.
4. **Draw Polygons**:
   - Select the **Polygon Tool**.
   - Click around the outer tips of the coconut leaves to form a circle/star shape covering the crown.
   - Do NOT annotate the shadow or the trunk.
   - Do the same for bananas and bushes (to teach the model what *not* to detect as coconuts).

---

## 3. How to Save (Exporting & Processing)

Once you've annotated your images (aim for at least 500-1000 coconut trees), you need to get them back into your local project.

1. **Export from Roboflow**:
   - Click **Generate Version** -> **Export**.
   - Select format: **YOLOv8 Segmentation**.
   - Download the `.zip` file to your PC.
2. **Extract Labels**: 
   - Extract the ZIP. You will see `.txt` files containing your polygon coordinates.
   - Place these `.txt` files into `ml/data/raw/annotated_labels/`.
3. **Run Dataset Generator**:
   Now, link your images and labels together into YOLO's required `train`/`val` structure:
   ```bash
   python scripts/dataset_generator.py --images coconut_dataset/images_to_label --labels data/raw/annotated_labels --output coconut_dataset
   ```
   *This script randomly splits your data into 80% training and 20% validation.*

---

## 4. How to Train & Save the Model

1. **Install YOLO**: Ensure you have Ultralytics installed.
   ```bash
   pip install ultralytics
   ```
2. **Start Training**:
   Run this command from inside the `ml` directory:
   ```bash
   yolo segment train data=coconut_dataset/dataset.yaml model=yolov8n-seg.pt epochs=100 imgsz=1024
   ```
3. **Where it Saves**: 
   Once training finishes, YOLO automatically saves your best model weights to:
   `runs/segment/train/weights/best.pt`

---

## 5. How to Run Inference (Testing the Results)

After training, you can test your new YOLO model on a full, stitched panorama!

```bash
python src/panorama_inference.py --image "path/to/your/massive_panorama.jpg" --model "runs/segment/train/weights/best.pt"
```
*This will slide across your panorama, detect the crowns, remove overlapping duplicates, and save a final output image ending in `_yolo_pred.jpg`!*
