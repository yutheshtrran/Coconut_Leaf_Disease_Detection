#!/usr/bin/env python3
"""
Enhanced Tree Segmentation and Labeling Module
High-accuracy individual coconut tree segmentation for drone imagery.

Key improvements over base segmentation.py:
- Watershed + distance transform for splitting touching/overlapping tree crowns
- Triple-method vegetation detection (HSV + ExG + NDVI approx) with majority voting
- IoU-based duplicate removal with quality scoring
- Consistent left-to-right, top-to-bottom tree numbering (1, 2, 3...)
- Colored per-tree mask overlays
- Disease classification per detected tree
- Full panoramic pipeline (stitch → segment → annotate)
"""

import cv2
cv2.ocl.setUseOpenCL(False)   # Disable OpenCL — prevents CL_OUT_OF_RESOURCES crashes in stitcher
import numpy as np
import torch
from torchvision import transforms
from PIL import Image
import os
from yaml import safe_load
import json
from typing import List, Dict, Tuple, Optional

# Optional imports
try:
    from scipy import ndimage
except ImportError:
    ndimage = None

try:
    from sklearn.cluster import KMeans
except ImportError:
    KMeans = None


# ===========================================================================
# Standalone functional API (importable without instantiating a class)
# ===========================================================================

def preprocess_for_trees(image: np.ndarray) -> np.ndarray:
    """
    Preprocess image to enhance individual tree crown visibility.
    CLAHE on LAB L-channel + bilateral denoising.
    """
    denoised = cv2.bilateralFilter(image, 9, 75, 75)
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


def detect_vegetation_mask(image: np.ndarray) -> np.ndarray:
    """
    Detect vegetation using three independent color indices.
    Requires ≥2 of 3 methods to agree → robust to lighting / shadow changes.

    Methods:
        1. HSV green range
        2. Excess Green Index (ExG = 2G - R - B)
        3. NDVI approximation from RGB channels

    Optimized: uses uint8 bitwise counting instead of int32 upcasting.
    """
    # 1. HSV
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hsv_mask = cv2.inRange(hsv, np.array([20, 30, 30]), np.array([100, 255, 255]))

    # 2. ExG  — vectorized, avoids full float32 split
    img_f = image.astype(np.float32)
    exg = np.clip(2.0 * img_f[:, :, 1] - img_f[:, :, 2] - img_f[:, :, 0], 0, None)
    exg_max = exg.max()
    if exg_max > 0:
        exg *= (255.0 / exg_max)
    exg_mask = (exg > 60).astype(np.uint8) * 255

    # 3. NDVI approx  — reuse channels from img_f
    g_ch = img_f[:, :, 1]
    r_ch = img_f[:, :, 2]
    ndvi = (g_ch - r_ch) / (g_ch + r_ch + 1e-5)
    ndvi_mask = (ndvi > 0.098).astype(np.uint8) * 255  # (0.098 ≈ (140/255)*2 - 1)

    # Majority vote (≥2 of 3) — bitwise approach avoids int32 arrays
    # For each pixel: count how many masks are 255; keep if ≥2
    vote = (hsv_mask > 0).astype(np.uint8) + (exg_mask > 0).astype(np.uint8) + (ndvi_mask > 0).astype(np.uint8)
    veg_mask = (vote >= 2).astype(np.uint8) * 255

    # Morphological cleanup
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    veg_mask = cv2.morphologyEx(veg_mask, cv2.MORPH_OPEN, k3)
    veg_mask = cv2.morphologyEx(veg_mask, cv2.MORPH_CLOSE, k5)

    return veg_mask


def segment_individual_trees_watershed(
    image: np.ndarray,
    vegetation_mask: np.ndarray,
    min_tree_area: int = None,
    max_tree_area: int = None
) -> List[Dict]:
    """
    Primary segmentation: watershed + distance transform.
    Splits touching/overlapping tree crowns into individual instances.
    """
    h, w = image.shape[:2]
    img_area = h * w
    min_tree_area = min_tree_area or max(200, int(img_area * 0.0003))
    max_tree_area = max_tree_area or int(img_area * 0.08)

    # Distance transform → local maxima = tree centers
    dist = cv2.distanceTransform(vegetation_mask, cv2.DIST_L2, 5)
    cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)

    _, sure_fg = cv2.threshold(dist, 0.35, 1.0, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg * 255)

    k7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    sure_bg = cv2.dilate(vegetation_mask, k7, iterations=2)
    unknown = cv2.subtract(sure_bg, sure_fg)

    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers_ws = cv2.watershed(image, markers)

    tree_regions = []
    for label in np.unique(markers_ws):
        if label <= 1:
            continue
        tree_mask = (markers_ws == label).astype(np.uint8) * 255
        contours, _ = cv2.findContours(tree_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(contour)
        if area < min_tree_area or area > max_tree_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        ar = float(bw) / (bh + 1e-5)
        if ar < 0.25 or ar > 4.0:
            continue

        M = cv2.moments(contour)
        cx = int(M['m10'] / M['m00']) if M['m00'] > 0 else x + bw // 2
        cy = int(M['m01'] / M['m00']) if M['m00'] > 0 else y + bh // 2

        hull_area = cv2.contourArea(cv2.convexHull(contour))
        solidity = float(area) / (hull_area + 1e-5)
        if solidity < 0.3:
            continue

        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter ** 2 + 1e-5)

        tree_regions.append({
            'label': int(label),
            'bbox': (x, y, bw, bh),
            'centroid': (cx, cy),
            'area': float(area),
            'solidity': float(solidity),
            'circularity': float(circularity),
            'aspect_ratio': float(ar),
            'contour': contour,
            'mask': tree_mask
        })

    return tree_regions


def segment_individual_trees_contour(
    image: np.ndarray,
    vegetation_mask: np.ndarray,
    min_tree_area: int = None,
    max_tree_area: int = None
) -> List[Dict]:
    """
    Fallback segmentation: contour-based with aggressive blob splitting.
    Supplements watershed when it finds too few trees.
    """
    h, w = image.shape[:2]
    img_area = h * w
    min_tree_area = min_tree_area or max(200, int(img_area * 0.0003))
    max_tree_area = max_tree_area or int(img_area * 0.08)

    contours, _ = cv2.findContours(vegetation_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    tree_regions = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_tree_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        ar = float(bw) / (bh + 1e-5)

        # Large blob → try to split
        if area > max_tree_area * 0.5:
            sub_mask = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(sub_mask, [contour], -1, 255, -1)
            dist = cv2.distanceTransform(sub_mask, cv2.DIST_L2, 5)
            cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)
            _, sub_fg = cv2.threshold(dist, 0.4, 1.0, cv2.THRESH_BINARY)
            sub_fg = np.uint8(sub_fg * 255)
            num_labels, _, stats, centroids = cv2.connectedComponentsWithStats(sub_fg)

            if num_labels > 2:
                for i in range(1, num_labels):
                    if stats[i, cv2.CC_STAT_AREA] < 50:
                        continue
                    scx, scy = int(centroids[i][0]), int(centroids[i][1])
                    est_r = max(int(np.sqrt(area / num_labels / np.pi)), 20)
                    rx1, ry1 = max(0, scx - est_r), max(0, scy - est_r)
                    rx2, ry2 = min(w, scx + est_r), min(h, scy + est_r)
                    rw, rh = rx2 - rx1, ry2 - ry1
                    if rw < 10 or rh < 10:
                        continue
                    tree_regions.append({
                        'label': len(tree_regions) + 100,
                        'bbox': (rx1, ry1, rw, rh),
                        'centroid': (scx, scy),
                        'area': float(rw * rh),
                        'solidity': 0.7, 'circularity': 0.5,
                        'aspect_ratio': float(rw) / (rh + 1e-5),
                        'contour': None, 'mask': None
                    })
                continue

        if area > max_tree_area or ar < 0.25 or ar > 4.0:
            continue

        M = cv2.moments(contour)
        cx = int(M['m10'] / M['m00']) if M['m00'] > 0 else x + bw // 2
        cy = int(M['m01'] / M['m00']) if M['m00'] > 0 else y + bh // 2

        hull_area = cv2.contourArea(cv2.convexHull(contour))
        solidity = float(area) / (hull_area + 1e-5)
        if solidity < 0.3:
            continue

        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter ** 2 + 1e-5)

        tree_regions.append({
            'label': len(tree_regions),
            'bbox': (x, y, bw, bh),
            'centroid': (cx, cy),
            'area': float(area),
            'solidity': float(solidity),
            'circularity': float(circularity),
            'aspect_ratio': float(ar),
            'contour': contour,
            'mask': None
        })

    return tree_regions


def remove_duplicate_trees(tree_regions: List[Dict], overlap_threshold: float = 0.4) -> List[Dict]:
    """
    IoU-based duplicate removal. Keeps the highest-quality detection per overlap group.
    Quality = solidity (50%) + circularity (30%) + normalized area (20%).
    """
    if not tree_regions:
        return tree_regions

    def iou(b1, b2):
        x1, y1, w1, h1 = b1
        x2, y2, w2, h2 = b2
        ix1, iy1 = max(x1, x2), max(y1, y2)
        ix2, iy2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0
        inter = (ix2 - ix1) * (iy2 - iy1)
        return inter / (w1 * h1 + w2 * h2 - inter + 1e-5)

    def quality(r):
        return r['solidity'] * 0.5 + r['circularity'] * 0.3 + min(r['area'] / 10000, 1.0) * 0.2

    unique = []
    for region in sorted(tree_regions, key=quality, reverse=True):
        if not any(iou(region['bbox'], k['bbox']) > overlap_threshold for k in unique):
            unique.append(region)
    return unique


def annotate_trees(
    image: np.ndarray,
    tree_regions: List[Dict],
    draw_mask: bool = True,
    draw_bbox: bool = True,
    draw_number: bool = True
) -> Tuple[np.ndarray, List[Dict]]:
    """
    Annotate image with individual tree detections.
    Each tree gets a unique number (1, 2, 3...) with a distinct color.
    """
    annotated = image.copy()
    tree_data = []

    # Generate perceptually distinct colors via golden-angle HSV
    np.random.seed(42)
    colors = []
    for i in range(len(tree_regions)):
        hue = int((i * 137.508) % 180)
        c_hsv = np.array([[[hue, 220, 220]]], dtype=np.uint8)
        c_bgr = cv2.cvtColor(c_hsv, cv2.COLOR_HSV2BGR)[0][0]
        colors.append((int(c_bgr[0]), int(c_bgr[1]), int(c_bgr[2])))

    for idx, region in enumerate(tree_regions):
        tree_num = idx + 1
        x, y, bw, bh = region['bbox']
        cx, cy = region['centroid']
        color = colors[idx] if idx < len(colors) else (0, 255, 0)

        # Semi-transparent mask overlay
        if draw_mask and region.get('mask') is not None:
            overlay = annotated.copy()
            mask_colored = np.zeros_like(image)
            mask_colored[region['mask'] == 255] = color
            annotated = cv2.addWeighted(overlay, 0.7, mask_colored, 0.3, 0)

        if draw_bbox:
            cv2.rectangle(annotated, (x, y), (x + bw, y + bh), color, 2)

        # Centroid dot with white border
        cv2.circle(annotated, (cx, cy), 4, color, -1)
        cv2.circle(annotated, (cx, cy), 4, (255, 255, 255), 1)

        if draw_number:
            label = str(tree_num)
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale, thickness = 0.55, 2
            tw, th = cv2.getTextSize(label, font, font_scale, thickness)[0]
            lx = max(0, cx - tw // 2)
            ly = max(th + 4, y - 4)
            pad = 3
            cv2.rectangle(annotated,
                          (lx - pad, ly - th - pad),
                          (lx + tw + pad, ly + pad),
                          color, -1)
            cv2.putText(annotated, label, (lx, ly), font, font_scale, (255, 255, 255), thickness)

        tree_data.append({
            'id': f'Tree_{tree_num}',
            'number': tree_num,
            'bbox': [x, y, x + bw, y + bh],
            'centroid': [cx, cy],
            'area': region['area'],
            'solidity': region['solidity'],
            'circularity': region['circularity'],
        })

    return annotated, tree_data


def stitch_panorama(image_paths: List[str], max_width: int = 4000) -> Optional[np.ndarray]:
    """
    Stitch multiple images into a high-resolution panorama.
    Tries PANORAMA then SCANS mode with automatic fallback.

    For robustness with many frames:
      - Limits input to MAX_STITCH_IMAGES (stitchers struggle with >25 images)
      - Auto-reduces max_width when many images are provided
      - Catches OpenCV internal errors gracefully
    """
    MAX_STITCH_IMAGES = 25  # OpenCV stitcher is unreliable with too many images

    if len(image_paths) < 2:
        return None

    # If too many images, sample evenly across the sequence
    paths_to_use = image_paths
    if len(image_paths) > MAX_STITCH_IMAGES:
        step = len(image_paths) / MAX_STITCH_IMAGES
        indices = [int(i * step) for i in range(MAX_STITCH_IMAGES)]
        paths_to_use = [image_paths[i] for i in indices]
        print(f"[INFO] Sampled {len(paths_to_use)}/{len(image_paths)} frames for stitching")

    # Auto-reduce max_width for many images to prevent OOM
    if len(paths_to_use) > 15:
        max_width = min(max_width, 2000)

    images = []
    for path in paths_to_use:
        img = cv2.imread(str(path))
        if img is None:
            print(f"[WARN] Could not read: {path}")
            continue
        h, w = img.shape[:2]
        if w > max_width:
            scale = max_width / w
            img = cv2.resize(img, (int(w * scale), int(h * scale)),
                             interpolation=cv2.INTER_AREA)
        images.append(img)

    if len(images) < 2:
        return None

    for mode in [cv2.Stitcher_PANORAMA, cv2.Stitcher_SCANS]:
        try:
            stitcher = cv2.Stitcher_create(mode)
            status, panorama = stitcher.stitch(images)
            if status == cv2.Stitcher_OK:
                print(f"[INFO] Stitching succeeded (mode={mode}, "
                      f"{len(images)} images → {panorama.shape[1]}×{panorama.shape[0]})")
                return panorama
            print(f"[WARN] Stitching failed (mode={mode}, status={status})")
        except cv2.error as e:
            print(f"[WARN] OpenCV stitcher error (mode={mode}): {e}")
        except Exception as e:
            print(f"[WARN] Unexpected stitcher error (mode={mode}): {e}")

    return None


def process_panoramic_images(
    image_paths: List[str],
    output_dir: str = None,
    min_tree_area: int = None,
    max_tree_area: int = None,
    classification_model=None,
    transform=None,
    class_names=None,
    device=None,
    verbose: bool = True
) -> Dict:
    """
    Full pipeline: stitch → preprocess → detect vegetation → segment → classify → annotate.

    Performance optimizations:
      - Large panoramas are downscaled for segmentation, then bboxes mapped back
      - Disease classification is batched into a single forward pass
      - GPU half-precision (AMP) is used when available

    Returns:
        panorama, annotated, tree_data, num_trees, vegetation_mask, tree_regions, disease_counts
    """
    import time as _time
    _t0 = _time.time()

    if verbose:
        print(f"[INFO] Processing {len(image_paths)} images...")

    # ── Stitch ────────────────────────────────────────────────────
    if len(image_paths) >= 2:
        panorama = stitch_panorama(image_paths)
        if panorama is None:
            if verbose:
                print("[WARN] Stitching failed — using first image")
            panorama = cv2.imread(image_paths[0])
    else:
        panorama = cv2.imread(image_paths[0])

    if panorama is None:
        raise ValueError("Could not load any images")

    orig_h, orig_w = panorama.shape[:2]
    if verbose:
        print(f"[INFO] Panorama: {orig_w}×{orig_h}")

    # ── Downscale for segmentation if large ───────────────────────
    SEG_MAX_EDGE = 3000  # max longest edge for segmentation ops
    longest = max(orig_h, orig_w)
    scale = 1.0
    if longest > SEG_MAX_EDGE:
        scale = SEG_MAX_EDGE / longest
        seg_img = cv2.resize(panorama,
                             (int(orig_w * scale), int(orig_h * scale)),
                             interpolation=cv2.INTER_AREA)
        if verbose:
            print(f"[PERF] Downscaled {orig_w}×{orig_h} → {seg_img.shape[1]}×{seg_img.shape[0]} (scale={scale:.3f})")
    else:
        seg_img = panorama

    preprocessed = preprocess_for_trees(seg_img)

    veg_mask = detect_vegetation_mask(preprocessed)
    if verbose:
        veg_pct = (np.sum(veg_mask > 0) / veg_mask.size) * 100
        print(f"[INFO] Vegetation coverage: {veg_pct:.1f}%")

    # ── Watershed (primary) ───────────────────────────────────────
    tree_regions = segment_individual_trees_watershed(
        preprocessed, veg_mask, min_tree_area, max_tree_area)
    if verbose:
        print(f"[INFO] Watershed: {len(tree_regions)} trees")

    # ── Contour fallback ──────────────────────────────────────────
    if len(tree_regions) < 5:
        contour_regions = segment_individual_trees_contour(
            preprocessed, veg_mask, min_tree_area, max_tree_area)
        if verbose:
            print(f"[INFO] Contour fallback: {len(contour_regions)} trees")
        tree_regions = tree_regions + contour_regions

    tree_regions = remove_duplicate_trees(tree_regions, overlap_threshold=0.35)
    if verbose:
        print(f"[INFO] After deduplication: {len(tree_regions)} trees")

    # ── Map bounding boxes back to full resolution ────────────────
    if scale < 1.0:
        inv = 1.0 / scale
        for r in tree_regions:
            x, y, w, h = r['bbox']
            r['bbox'] = (int(x * inv), int(y * inv), int(w * inv), int(h * inv))
            cx, cy = r['centroid']
            r['centroid'] = (int(cx * inv), int(cy * inv))
            r['area'] *= (inv * inv)
        # Upscale vegetation mask for stats
        veg_mask = cv2.resize(veg_mask, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)

    # Sort left-to-right, top-to-bottom for consistent numbering
    tree_regions = sorted(tree_regions,
                          key=lambda r: (r['centroid'][1] // 100, r['centroid'][0]))

    # ── Classify diseases (batched + AMP) ─────────────────────────
    disease_counts = {}
    if classification_model and transform and class_names:
        if verbose:
            print(f"[INFO] Classifying {len(tree_regions)} trees (batched)...")

        _dev = device or 'cpu'
        BATCH_SIZE = 64  # max crops per forward pass

        # Prepare all crops + tensors
        crop_tensors = []
        crop_indices = []  # indices into tree_regions that have valid crops

        for idx, region in enumerate(tree_regions):
            try:
                x, y, w, h = region['bbox']
                pad = int(min(w, h) * 0.1)
                x1, y1 = max(0, x - pad), max(0, y - pad)
                x2, y2 = min(panorama.shape[1], x + w + pad), min(panorama.shape[0], y + h + pad)

                tree_crop = panorama[y1:y2, x1:x2]
                if tree_crop.size == 0:
                    region['disease'] = 'Unknown'
                    region['confidence'] = 0.0
                    continue

                pil_img = Image.fromarray(cv2.cvtColor(tree_crop, cv2.COLOR_BGR2RGB))
                tensor = transform(pil_img)
                crop_tensors.append(tensor)
                crop_indices.append(idx)
            except Exception as e:
                print(f"[WARN] Crop preparation failed for tree {idx}: {e}")
                region['disease'] = 'Unknown'
                region['confidence'] = 0.0

        # Batched forward pass
        if crop_tensors:
            all_preds = []
            all_confs = []

            for batch_start in range(0, len(crop_tensors), BATCH_SIZE):
                batch = torch.stack(crop_tensors[batch_start:batch_start + BATCH_SIZE]).to(_dev)

                with torch.no_grad():
                    # Use AMP half-precision on CUDA for ~1.5-2× speedup
                    if str(_dev) != 'cpu' and hasattr(torch.cuda, 'amp'):
                        with torch.cuda.amp.autocast():
                            outputs = classification_model(batch)
                    else:
                        outputs = classification_model(batch)

                    probs = torch.softmax(outputs, dim=1)
                    pred_indices = torch.argmax(probs, dim=1)
                    confidences = probs[torch.arange(probs.size(0)), pred_indices]

                    all_preds.extend(pred_indices.cpu().tolist())
                    all_confs.extend(confidences.cpu().tolist())

            # Map predictions back to tree_regions
            for i, region_idx in enumerate(crop_indices):
                pred_idx = all_preds[i]
                confidence = all_confs[i]
                dis = class_names[pred_idx] if pred_idx < len(class_names) else 'Unknown'
                tree_regions[region_idx]['disease'] = dis
                tree_regions[region_idx]['confidence'] = confidence
                disease_counts[dis] = disease_counts.get(dis, 0) + 1
    else:
        if verbose:
            print("[INFO] No classification model provided — skipping disease detection")

    # ── Annotate on full-resolution panorama ───────────────────────
    annotated, tree_data = annotate_trees_enhanced(panorama, tree_regions)

    if verbose:
        elapsed = _time.time() - _t0
        print(f"[INFO] Final tree count: {len(tree_data)}")
        print(f"[PERF] Total process_panoramic_images: {elapsed:.2f}s")

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        cv2.imwrite(os.path.join(output_dir, "panorama.jpg"), panorama)
        cv2.imwrite(os.path.join(output_dir, "annotated_trees.jpg"), annotated)
        cv2.imwrite(os.path.join(output_dir, "vegetation_mask.jpg"), veg_mask)
        if verbose:
            print(f"[INFO] Outputs saved to {output_dir}")

    return {
        'panorama': panorama,
        'annotated': annotated,
        'tree_data': tree_data,
        'num_trees': len(tree_data),
        'vegetation_mask': veg_mask,
        'tree_regions': tree_regions,
        'disease_counts': disease_counts
    }


def annotate_trees_enhanced(
    image: np.ndarray,
    tree_regions: List[Dict]
) -> Tuple[np.ndarray, List[Dict]]:
    """
    Annotate with tree numbers only — red circles, no disease labels.
    """
    annotated = image.copy()
    tree_data = []

    RED = (0, 0, 255)  # BGR red
    WHITE = (255, 255, 255)
    font = cv2.FONT_HERSHEY_SIMPLEX

    for idx, region in enumerate(tree_regions):
        tree_num = idx + 1
        x, y, bw, bh = region['bbox']
        cx, cy = region['centroid']

        label = str(tree_num)
        font_scale = 0.55
        thickness = 2
        (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)

        # Circle radius — big enough to contain the number
        radius = max(14, tw // 2 + 10, th // 2 + 10)

        # Draw filled red circle with white border
        cv2.circle(annotated, (cx, cy), radius, RED, -1)
        cv2.circle(annotated, (cx, cy), radius, WHITE, 2)

        # Centre the number text inside the circle
        tx = cx - tw // 2
        ty = cy + th // 2
        cv2.putText(annotated, label, (tx, ty), font, font_scale, WHITE, thickness, cv2.LINE_AA)

        tree_data.append({
            'id': f'Tree_{tree_num}',
            'number': tree_num,
            'bbox': [x, y, x + bw, y + bh],
            'centroid': [cx, cy],
            'disease': region.get('disease'),
            'confidence': region.get('confidence')
        })

    return annotated, tree_data


# ===========================================================================
# EnhancedTreeSegmenter class — full OOP interface with disease classification
# ===========================================================================

class EnhancedTreeSegmenter:
    """
    High-accuracy segmentation and detection of individual coconut trees.

    Combines:
    - Watershed + distance transform (primary)
    - Contour-based splitting (fallback)
    - Multi-method vegetation detection
    - Disease classification per tree
    """

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "config.yaml")

        with open(config_path) as f:
            self.config = safe_load(f)

        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.image_size = self.config.get('image_size', 224)
        self.class_names = self._load_class_names()
        self.disease_model = self._load_disease_model()

        self.transform = transforms.Compose([
            transforms.Resize((self.image_size, self.image_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def _load_disease_model(self):
        from torchvision import models
        try:
            model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
            weights_path = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")

            if os.path.exists(weights_path):
                checkpoint = torch.load(weights_path, map_location=self.device)
                if isinstance(checkpoint, dict):
                    if 'fc.weight' in checkpoint:
                        n = checkpoint['fc.weight'].shape[0]
                        if n != len(self.class_names):
                            print(f"Warning: Checkpoint has {n} classes, adjusting.")
                            if len(self.class_names) > n:
                                self.class_names = self.class_names[:n]
                            else:
                                while len(self.class_names) < n:
                                    self.class_names.append(f"Class_{len(self.class_names)}")
                    model.fc = torch.nn.Linear(model.fc.in_features, len(self.class_names))
                    model.load_state_dict(
                        {k.replace('module.', ''): v for k, v in checkpoint.items()}, strict=False)
                else:
                    model = checkpoint

            model.to(self.device)
            model.eval()
            return model
        except Exception as e:
            print(f"Warning: Could not load disease model: {e}")
            return None

    def _load_class_names(self):
        disease_info_path = os.path.join(os.path.dirname(__file__), '..', 'logs', 'disease_info.json')
        class_names = self.config.get('class_names', [])
        try:
            if os.path.exists(disease_info_path):
                with open(disease_info_path, 'r') as f:
                    info = json.load(f)
                    if isinstance(info, dict) and info:
                        class_names = list(info.keys())
        except Exception:
            pass
        return class_names or ['Healthy', 'Leaf Blight', 'Leaf Yellowing', 'Powdery Mildew', 'Rust']

    # ------------------------------------------------------------------
    # Detection pipeline
    # ------------------------------------------------------------------

    def detect_green_areas_enhanced(self, frame: np.ndarray) -> np.ndarray:
        """Multi-method vegetation detection (delegates to module-level function)."""
        return detect_vegetation_mask(frame)

    def segment_trees_enhanced(self, frame: np.ndarray):
        """
        Segment individual trees using watershed + contour fallback.
        Returns (tree_regions, centroids, green_mask).
        """
        preprocessed = preprocess_for_trees(frame)
        green_mask = detect_vegetation_mask(preprocessed)

        # Watershed primary
        tree_regions = segment_individual_trees_watershed(preprocessed, green_mask)

        # Contour fallback
        if len(tree_regions) < 5:
            contour_regions = segment_individual_trees_contour(preprocessed, green_mask)
            tree_regions = tree_regions + contour_regions

        tree_regions = remove_duplicate_trees(tree_regions, overlap_threshold=0.35)
        tree_regions = sorted(tree_regions,
                              key=lambda r: (r['centroid'][1] // 100, r['centroid'][0]))

        centroids = [r['centroid'] for r in tree_regions]
        return tree_regions, centroids, green_mask

    # ------------------------------------------------------------------
    # Health classification
    # ------------------------------------------------------------------

    def classify_tree_health(self, frame: np.ndarray, tree_region: Dict):
        """Classify health of a tree region using the disease model."""
        try:
            if self.disease_model is None:
                return 'Unknown', 0.0

            x, y, w, h = tree_region['bbox']
            pad = int(min(w, h) * 0.1)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(frame.shape[1], x + w + pad)
            y2 = min(frame.shape[0], y + h + pad)
            tree_img = frame[y1:y2, x1:x2]

            if tree_img.size == 0:
                return 'Unknown', 0.0

            pil_img = Image.fromarray(cv2.cvtColor(tree_img, cv2.COLOR_BGR2RGB))
            img_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

            with torch.no_grad():
                outputs = self.disease_model(img_tensor)
                pred_idx = torch.argmax(outputs, 1).item()
                confidence = torch.softmax(outputs, dim=1)[0][pred_idx].item()
                disease_name = (self.class_names[pred_idx]
                                if pred_idx < len(self.class_names) else 'Unknown')
                return disease_name, float(confidence)
        except Exception as e:
            print(f"Error classifying tree health: {e}")
            return 'Unknown', 0.0

    def calculate_health_percentage(self, disease_name: str, confidence: float) -> float:
        if disease_name.lower() == 'healthy':
            return min(100.0, confidence * 100)
        return max(0.0, (1.0 - confidence) * 100)

    def estimate_farm_size(self, frame: np.ndarray, tree_regions: List[Dict]) -> float:
        if not tree_regions:
            return 0.0
        green_area = sum(r['area'] for r in tree_regions)
        total_pixels = frame.shape[0] * frame.shape[1]
        coverage_percent = (green_area / total_pixels) * 100
        avg_tree_area = green_area / len(tree_regions)
        return max(0.01, min((len(tree_regions) * avg_tree_area) / 100000, 10))

    # ------------------------------------------------------------------
    # Annotation
    # ------------------------------------------------------------------

    def label_trees_on_frame(self, frame: np.ndarray, tree_regions: List[Dict],
                              include_metrics: bool = True):
        """
        Draw numbered red circles only — no disease labels, no metrics text.
        Returns (annotated_frame, disease_counts).
        """
        RED = (0, 0, 255)
        WHITE = (255, 255, 255)
        font = cv2.FONT_HERSHEY_SIMPLEX
        annotated_frame = frame.copy()
        disease_counts = {}

        for idx, region in enumerate(tree_regions):
            tree_num = idx + 1
            cx, cy = region['centroid']

            disease, confidence = self.classify_tree_health(frame, region)
            disease_counts[disease] = disease_counts.get(disease, 0) + 1
            region['disease'] = disease
            region['confidence'] = confidence

            label = str(tree_num)
            font_scale = 0.55
            thickness = 2
            (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)
            radius = max(14, tw // 2 + 10, th // 2 + 10)

            cv2.circle(annotated_frame, (cx, cy), radius, RED, -1)
            cv2.circle(annotated_frame, (cx, cy), radius, WHITE, 2)
            cv2.putText(annotated_frame, label,
                        (cx - tw // 2, cy + th // 2),
                        font, font_scale, WHITE, thickness, cv2.LINE_AA)

        return annotated_frame, disease_counts

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        Complete processing pipeline for a single frame.
        Returns a rich dict with all statistics.
        """
        tree_regions, centroids, green_mask = self.segment_trees_enhanced(frame)
        labeled_frame, disease_counts = self.label_trees_on_frame(frame, tree_regions)

        num_trees = len(tree_regions)
        farm_size = self.estimate_farm_size(frame, tree_regions)
        healthy_count = disease_counts.get('Healthy', 0)
        diseased_count = num_trees - healthy_count
        health_percentage = (healthy_count / num_trees * 100) if num_trees > 0 else 0
        avg_tree_area = sum(r['area'] for r in tree_regions) / num_trees if num_trees > 0 else 0
        avg_solidity = sum(r['solidity'] for r in tree_regions) / num_trees if num_trees > 0 else 0

        return {
            'num_trees': num_trees,
            'tree_regions': tree_regions,
            'centroids': centroids,
            'disease_counts': disease_counts,
            'healthy_count': healthy_count,
            'diseased_count': diseased_count,
            'health_percentage': health_percentage,
            'farm_size': farm_size,
            'labeled_frame': labeled_frame,
            'green_mask': green_mask,
            'avg_tree_area': avg_tree_area,
            'avg_solidity': avg_solidity
        }


def create_enhanced_segmenter(config_path: str = None) -> EnhancedTreeSegmenter:
    """Factory function to create an EnhancedTreeSegmenter instance."""
    return EnhancedTreeSegmenter(config_path)
