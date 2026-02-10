# Drone Image Pipeline for Coconut Farm Analysis

This pipeline processes multiple overlapping drone images of coconut plantations to create a high-resolution panoramic image, then uses YOLOv8 for object detection and instance segmentation to identify individual coconut trees.

## Features

- **Image Stitching**: Merges multiple overlapping drone images into a single panoramic view using OpenCV
- **Object Detection & Segmentation**: Uses YOLOv8 with segmentation support to detect and segment individual coconut trees
- **Tree Identification**: Assigns unique IDs to each detected tree
- **Visualization**: Annotates the panoramic image with red bounding boxes and tree IDs
- **Data Export**: Outputs structured data in JSON and CSV formats for further analysis

## Requirements

- Python 3.8+
- OpenCV
- Ultralytics YOLOv8
- NumPy
- Matplotlib

Install dependencies:
```bash
pip install ultralytics opencv-python numpy matplotlib
```

## Usage

### Command Line

```bash
python src/drone_pipeline.py --input_dir /path/to/drone/images --output_dir /path/to/output
```

### Parameters

- `--input_dir`: Directory containing the drone images (required)
- `--output_dir`: Output directory for results (default: 'output')
- `--model_path`: Path to YOLO model weights (default: 'yolov8n-seg.pt')

### Example

```bash
python src/drone_pipeline.py --input_dir ./drone_images --output_dir ./results --model_path yolov8n-seg.pt
```

## Input

- A directory containing multiple overlapping drone images (JPG, PNG, BMP, TIFF)
- At least 2 images are required for stitching

## Output

The pipeline generates the following files in the output directory:

1. **panorama.jpg**: The stitched panoramic image
2. **annotated_trees.jpg**: The panoramic image with tree detections annotated
3. **tree_data.json**: JSON file containing tree IDs, bounding box coordinates, and confidence scores
4. **tree_data.csv**: CSV file with the same data for easy import into spreadsheets

### JSON Structure

```json
[
  {
    "id": "Tree_1",
    "bbox": [x1, y1, x2, y2],
    "confidence": 0.85
  },
  ...
]
```

## Model Training

For accurate coconut tree detection, you should train a custom YOLOv8 model on coconut tree images. The current implementation uses the pre-trained YOLOv8 segmentation model, which may not be optimal for coconut trees.

To train a custom model:

1. Collect and annotate coconut tree images
2. Use Ultralytics YOLO training:
   ```python
   from ultralytics import YOLO
   model = YOLO('yolov8n-seg.pt')
   model.train(data='coconut_trees.yaml', epochs=100)
   ```
3. Use the trained model with `--model_path path/to/best.pt`

## Integration

This pipeline can be integrated into the existing ML API by adding an endpoint in `app.py` that calls the `drone_pipeline.py` script or imports its functions.

## Notes

- Ensure drone images have sufficient overlap (30-50%) for successful stitching
- The pipeline assumes top-view drone images of coconut plantations
- For best results, use images taken at similar altitudes and lighting conditions
- Processing time depends on image resolution and number of images