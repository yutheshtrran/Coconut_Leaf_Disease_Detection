#!/usr/bin/env python3
"""
Drone Image Pipeline for Coconut Farm Analysis

This script processes multiple overlapping drone images to create a panoramic view,
then performs object detection and segmentation to identify individual coconut trees.

Features for improved accuracy:
- Enhanced image stitching with fallback modes
- Image preprocessing (CLAHE, denoising, sharpening)
- Optimized YOLOv8m model with tuned parameters
- Detection filtering and confidence analysis

Usage:
    python drone_pipeline.py --input_dir /path/to/drone/images --output_dir /path/to/output

Requirements:
    - OpenCV for image stitching
    - Ultralytics YOLOv8 for detection and segmentation
"""

import os
import cv2
import json
import argparse
import numpy as np
from ultralytics import YOLO
from pathlib import Path
import matplotlib.pyplot as plt


def stitch_images(image_paths):
    """
    Stitch multiple overlapping images into a single panoramic image using OpenCV.

    Args:
        image_paths (list): List of paths to input images

    Returns:
        numpy.ndarray: Stitched panoramic image, or None if stitching fails
    """
    if len(image_paths) < 2:
        print("Need at least 2 images for stitching")
        return None

    # Read images
    images = []
    for path in image_paths:
        img = cv2.imread(str(path))
        if img is None:
            print(f"Failed to read image: {path}")
            continue

        # Resize images if they're too large (helps with memory and processing)
        height, width = img.shape[:2]
        if width > 2000:
            scale = 2000 / width
            new_width = int(width * scale)
            new_height = int(height * scale)
            img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)

        images.append(img)

    if len(images) < 2:
        print("Not enough valid images for stitching")
        return None

    # Try stitching with different modes for better results
    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    status, panorama = stitcher.stitch(images)

    if status != cv2.Stitcher_OK:
        print(f"Standard stitching failed with status: {status}")
        # Try with SCANS mode as fallback
        try:
            stitcher_scans = cv2.Stitcher_create(cv2.Stitcher_SCANS)
            status, panorama = stitcher_scans.stitch(images)
            if status != cv2.Stitcher_OK:
                print(f"SCANS stitching also failed with status: {status}")
                return None
        except:
            return None

    return panorama


def preprocess_image(image):
    """
    Preprocess image to improve detection accuracy.

    Args:
        image (numpy.ndarray): Input image

    Returns:
        numpy.ndarray: Preprocessed image
    """
    # Convert to LAB color space for better contrast enhancement
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)

    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])

    # Convert back to BGR
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # Apply slight Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)

    # Apply sharpening filter
    kernel = np.array([[-1,-1,-1],
                       [-1, 9,-1],
                       [-1,-1,-1]])
    sharpened = cv2.filter2D(blurred, -1, kernel)

    return sharpened


def detect_trees_yolo(panorama, model_path='yolov8m-seg.pt'):
    """
    Perform object detection and segmentation on the panoramic image using YOLO.

    Args:
        panorama (numpy.ndarray): Input panoramic image
        model_path (str): Path to YOLO model weights (default: yolov8m-seg.pt for better accuracy)

    Returns:
        dict: Results containing detections, masks, etc.
    """
    # Preprocess image for better detection
    processed_panorama = preprocess_image(panorama)

    # Load YOLO model
    model = YOLO(model_path)

    # Run inference with optimized parameters for better accuracy
    results = model(processed_panorama, conf=0.25, iou=0.4, max_det=500)

    return results


def filter_detections(tree_data, min_confidence=0.3, min_area=1000):
    """
    Filter detections to remove low-confidence and small detections.

    Args:
        tree_data (list): List of tree detection dictionaries
        min_confidence (float): Minimum confidence threshold
        min_area (int): Minimum bounding box area

    Returns:
        list: Filtered tree data
    """
    filtered = []

    for tree in tree_data:
        conf = tree['confidence']
        bbox = tree['bbox']
        area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])

        if conf >= min_confidence and area >= min_area:
            filtered.append(tree)

    return filtered


def annotate_image(image, results):
    """
    Annotate the image with bounding boxes and IDs for detected trees.

    Args:
        image (numpy.ndarray): Input image to annotate
        results: YOLO results object

    Returns:
        tuple: (annotated_image, tree_data)
            - annotated_image: Image with annotations
            - tree_data: List of dicts with tree IDs and bounding boxes
    """
    annotated = image.copy()
    tree_data = []

    # Get detections
    boxes = results[0].boxes
    masks = results[0].masks

    for i, (box, mask) in enumerate(zip(boxes, masks)):
        # Get bounding box coordinates
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

        # Draw red bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)

        # Add tree ID text
        tree_id = f"Tree_{i+1}"
        cv2.putText(annotated, tree_id, (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX,
                   0.9, (0, 0, 255), 2)

        # Store tree data
        tree_data.append({
            'id': tree_id,
            'bbox': [x1, y1, x2, y2],
            'confidence': float(box.conf[0].cpu().numpy())
        })

    # Filter detections for better accuracy
    tree_data = filter_detections(tree_data)

    # Re-annotate with filtered results
    annotated = image.copy()
    for i, tree in enumerate(tree_data):
        bbox = tree['bbox']
        x1, y1, x2, y2 = bbox

        # Draw green bounding box for filtered results
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Add tree ID text
        tree_id = f"Tree_{i+1}"
        cv2.putText(annotated, f"{tree_id} ({tree['confidence']:.2f})",
                   (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

        # Update tree ID in data
        tree['id'] = tree_id

    return annotated, tree_data


def save_outputs(panorama, annotated, tree_data, output_dir):
    """
    Save the panoramic image, annotated image, and tree data.

    Args:
        panorama (numpy.ndarray): Original panoramic image
        annotated (numpy.ndarray): Annotated image
        tree_data (list): List of tree data dictionaries
        output_dir (str): Output directory path
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save panoramic image
    panorama_path = output_dir / "panorama.jpg"
    cv2.imwrite(str(panorama_path), panorama)
    print(f"Saved panorama to: {panorama_path}")

    # Save annotated image
    annotated_path = output_dir / "annotated_trees.jpg"
    cv2.imwrite(str(annotated_path), annotated)
    print(f"Saved annotated image to: {annotated_path}")

    # Save tree data as JSON
    json_path = output_dir / "tree_data.json"
    with open(json_path, 'w') as f:
        json.dump(tree_data, f, indent=2)
    print(f"Saved tree data to: {json_path}")

    # Save as CSV
    csv_path = output_dir / "tree_data.csv"
    import csv
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', 'X1', 'Y1', 'X2', 'Y2', 'Confidence'])
        for tree in tree_data:
            writer.writerow([tree['id'], *tree['bbox'], tree['confidence']])
    print(f"Saved tree data to: {csv_path}")


def main():
    parser = argparse.ArgumentParser(description="Drone Image Pipeline for Coconut Farm Analysis")
    parser.add_argument('--input_dir', required=True, help='Directory containing drone images')
    parser.add_argument('--output_dir', default='output', help='Output directory for results')
    parser.add_argument('--model_path', default='yolov8m-seg.pt',
                       help='Path to YOLO model weights (default: yolov8m-seg.pt)')

    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.exists():
        print(f"Input directory does not exist: {input_dir}")
        return

    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
    image_paths = [p for p in input_dir.iterdir() if p.suffix.lower() in image_extensions]

    if len(image_paths) < 2:
        print(f"Need at least 2 images, found {len(image_paths)}")
        return

    print(f"Found {len(image_paths)} images for stitching")

    # Stitch images
    print("Stitching images...")
    panorama = stitch_images(image_paths)

    if panorama is None:
        print("Failed to create panorama")
        return

    print("Panorama created successfully")

    # Detect trees
    print("Running YOLO detection and segmentation...")
    results = detect_trees_yolo(panorama, args.model_path)

    # Annotate image
    print("Annotating image with tree detections...")
    annotated, tree_data = annotate_image(panorama, results)

    print(f"Detected {len(tree_data)} trees")

    # Print detection statistics
    if tree_data:
        confidences = [tree['confidence'] for tree in tree_data]
        avg_confidence = sum(confidences) / len(confidences)
        min_confidence = min(confidences)
        max_confidence = max(confidences)

        print(".2f")
        print(".2f")
        print(".2f")

        # Show confidence distribution
        high_conf = sum(1 for c in confidences if c >= 0.8)
        med_conf = sum(1 for c in confidences if 0.5 <= c < 0.8)
        low_conf = sum(1 for c in confidences if c < 0.5)

        print(f"Confidence distribution: High (≥0.8): {high_conf}, Medium (0.5-0.8): {med_conf}, Low (<0.5): {low_conf}")

    # Save outputs
    save_outputs(panorama, annotated, tree_data, args.output_dir)

    print("Pipeline completed successfully!")


if __name__ == "__main__":
    main()