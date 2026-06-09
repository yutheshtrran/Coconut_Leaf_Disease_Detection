#!/usr/bin/env python3
"""
High-accuracy Coconut Tree Crown Detector for Aerial Drone Imagery.

Pipeline:
  1. Preprocess image
  2. Extract vegetation / canopy mask
  3. Split merged crowns using watershed
  4. Find crown centers from per-crown distance maps
  5. Validate candidates using shape + radial texture
  6. Deduplicate detections with NMS
  7. Final validation

Designed to reduce:
- multiple circles on one tree
- shrub / bush false positives
- oversized circles
- missed trees in dense plantations
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional


# ============================================================================
# GLOBAL TUNING
# ============================================================================

MAX_EDGE = 3200

# Canopy mask thresholds
HSV_LOW = (20, 20, 20)
HSV_HIGH = (100, 255, 245)
EXG_THRESH = 14
GREEN_RATIO_THRESH = 1.05

# Morphology
CLOSE_SCALE = 0.010
OPEN_SCALE = 0.010
MIN_BLOB_AREA_FRAC = 0.00002

# Watershed / split
WATERSHED_SURE_FG_RATIO = 0.38
MIN_REGION_AREA_FRAC = 0.00003

# Peak detection
PEAK_KERNEL_SCALE = 0.010
MIN_PEAK_ABS_SCALE = 0.0010
MIN_PEAK_ABS_LOW = 1.6
MIN_PEAK_ABS_HIGH = 5.0
MIN_PEAK_REL = 0.24

# Crown sizing
SPACING_RADIUS_MULT = 0.33
MIN_RADIUS_FALLBACK_FRAC = 0.022

# Validation
MIN_CONTOUR_AREA_FACTOR = 0.20
MIN_CIRCULARITY = 0.12
MIN_SOLIDITY = 0.28
MIN_RADIAL_SCORE = 0.24
MIN_CONFIDENCE = 0.12

# NMS
NMS_DIST_MULT = 1.00
NMS_MIN_DIST_FLOOR = 18
NMS_IOU_THRESH = 0.18

# Final validation
FINAL_MIN_AREA_FRAC = 0.00008
FINAL_MIN_AREA_FLOOR = 900
FINAL_MAX_AREA_FRAC = 0.05
FINAL_MIN_RADIUS = 8
FINAL_MIN_CONFIDENCE = 0.14
FINAL_MIN_RADIAL = 0.24
FINAL_MIN_CIRCULARITY = 0.10
FINAL_MIN_SOLIDITY = 0.24


# ============================================================================
# STEP 1: PREPROCESS
# ============================================================================

def _preprocess(image: np.ndarray) -> np.ndarray:
    """
    Denoise while preserving edges and improve crown contrast.
    """
    smooth = cv2.bilateralFilter(image, d=9, sigmaColor=75, sigmaSpace=75)

    lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    return enhanced


# ============================================================================
# STEP 2: CANOPY MASK
# ============================================================================

def _odd(x: int) -> int:
    return x if x % 2 == 1 else x + 1


def _extract_canopy_mask(image: np.ndarray) -> np.ndarray:
    """
    Build a robust canopy mask using multiple green cues + cleanup.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    mask_hsv = cv2.inRange(hsv, HSV_LOW, HSV_HIGH)

    b_ch = image[:, :, 0].astype(np.int16)
    g_ch = image[:, :, 1].astype(np.int16)
    r_ch = image[:, :, 2].astype(np.int16)

    exg = 2 * g_ch - r_ch - b_ch
    mask_exg = (exg > EXG_THRESH).astype(np.uint8) * 255

    denom = np.maximum(np.maximum(r_ch, b_ch), 1)
    green_ratio = g_ch.astype(np.float32) / denom.astype(np.float32)
    mask_ratio = (green_ratio > GREEN_RATIO_THRESH).astype(np.uint8) * 255

    vote = (
        mask_hsv.astype(np.int16)
        + mask_exg.astype(np.int16)
        + mask_ratio.astype(np.int16)
    )
    canopy = (vote >= 2 * 255).astype(np.uint8) * 255

    h, w = image.shape[:2]

    close_size = _odd(max(7, min(15, int(min(h, w) * CLOSE_SCALE))))
    open_size = _odd(max(5, min(13, int(min(h, w) * OPEN_SCALE))))

    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size))
    k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_size, open_size))

    canopy = cv2.morphologyEx(canopy, cv2.MORPH_CLOSE, k_close, iterations=2)
    canopy = cv2.morphologyEx(canopy, cv2.MORPH_OPEN, k_open, iterations=1)

    # Remove tiny vegetation blobs
    n_cc, labels, stats, _ = cv2.connectedComponentsWithStats(canopy)
    cleaned = np.zeros_like(canopy)
    min_blob_area = max(80, int(h * w * MIN_BLOB_AREA_FRAC))

    for i in range(1, n_cc):
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_blob_area:
            cleaned[labels == i] = 255

    return cleaned


# ============================================================================
# STEP 3: WATERSHED SPLITTING
# ============================================================================

def _split_canopy_watershed(image: np.ndarray, canopy_mask: np.ndarray) -> np.ndarray:
    """
    Split touching crowns into separate labels using watershed.
    Returns marker image:
      -1 = watershed boundary
       1 = background
      >=2 = separated canopy regions
    """
    h, w = canopy_mask.shape[:2]

    # Distance transform on binary canopy
    dist = cv2.distanceTransform(canopy_mask, cv2.DIST_L2, 5)
    max_dist = float(dist.max())

    if max_dist < 1.0:
        return np.ones((h, w), dtype=np.int32)

    sure_fg = (dist >= max_dist * WATERSHED_SURE_FG_RATIO).astype(np.uint8) * 255

    # clean sure foreground a bit
    fg_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (_odd(max(3, int(min(h, w) * 0.004))),) * 2)
    sure_fg = cv2.morphologyEx(sure_fg, cv2.MORPH_OPEN, fg_k, iterations=1)

    sure_bg = cv2.dilate(
        canopy_mask,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (_odd(max(5, int(min(h, w) * 0.006))),) * 2),
        iterations=2,
    )

    unknown = cv2.subtract(sure_bg, sure_fg)
    n_markers, markers = cv2.connectedComponents(sure_fg)

    markers = markers + 1
    markers[unknown == 255] = 0

    # watershed needs color image
    ws_input = image.copy()
    markers = cv2.watershed(ws_input, markers)

    return markers


# ============================================================================
# STEP 4: CENTER FINDING
# ============================================================================

def _find_crown_centers(
    canopy_mask: np.ndarray,
    markers: np.ndarray,
) -> List[Tuple[int, int, float]]:
    """
    Find one or a few high-quality centers per watershed crown region.
    """
    h, w = canopy_mask.shape[:2]
    img_diag = float((h ** 2 + w ** 2) ** 0.5)

    centers: List[Tuple[int, int, float]] = []
    min_region_area = max(100, int(h * w * MIN_REGION_AREA_FRAC))

    unique_labels = np.unique(markers)
    for label in unique_labels:
        if label <= 1:
            continue

        region = (markers == label).astype(np.uint8) * 255
        area = int(np.count_nonzero(region))
        if area < min_region_area:
            continue

        dist = cv2.distanceTransform(region, cv2.DIST_L2, 5)
        max_dist = float(dist.max())
        if max_dist < 1.5:
            continue

        kernel_size = _odd(max(7, int(min(h, w) * PEAK_KERNEL_SCALE)))
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        dilated = cv2.dilate(dist, k)

        abs_peak_thresh = max(
            MIN_PEAK_ABS_LOW,
            min(MIN_PEAK_ABS_HIGH, img_diag * MIN_PEAK_ABS_SCALE)
        )
        peak_thresh = max(abs_peak_thresh, max_dist * MIN_PEAK_REL)

        peaks = ((dist >= dilated - 1e-5) & (dist >= peak_thresh)).astype(np.uint8) * 255
        n_cc, labels, stats, centroids = cv2.connectedComponentsWithStats(peaks)

        region_centers = []
        for i in range(1, n_cc):
            peak_area = stats[i, cv2.CC_STAT_AREA]
            if peak_area < 1:
                continue

            cx = int(centroids[i][0])
            cy = int(centroids[i][1])
            peak_dist = float(dist[cy, cx])

            if peak_dist >= abs_peak_thresh:
                region_centers.append((cx, cy, peak_dist))

        # If multiple peaks survive in one region, keep strongest unless well-separated
        region_centers = sorted(region_centers, key=lambda x: x[2], reverse=True)
        filtered_region_centers: List[Tuple[int, int, float]] = []
        for cx, cy, peak_dist in region_centers:
            too_close = any(
                ((cx - ex) ** 2 + (cy - ey) ** 2) ** 0.5 < max(10, peak_dist * 1.2)
                for ex, ey, _ in filtered_region_centers
            )
            if not too_close:
                filtered_region_centers.append((cx, cy, peak_dist))

        if not filtered_region_centers:
            # fallback: use maximum point
            yx = np.unravel_index(np.argmax(dist), dist.shape)
            cy, cx = int(yx[0]), int(yx[1])
            filtered_region_centers.append((cx, cy, max_dist))

        centers.extend(filtered_region_centers)

    return centers


# ============================================================================
# STEP 5: RADIAL TEXTURE
# ============================================================================

def _analyze_radial_pattern(image: np.ndarray, cx: int, cy: int, radius: int) -> float:
    """
    Coconut crowns often create outward/radial frond gradients.
    Returns score in [0, 1].
    """
    h, w = image.shape[:2]
    r = max(8, min(radius, 100))

    y1, y2 = max(0, cy - r), min(h, cy + r)
    x1, x2 = max(0, cx - r), min(w, cx + r)

    if (x2 - x1) < 20 or (y2 - y1) < 20:
        return 0.5

    region = image[y1:y2, x1:x2]
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

    mag = np.sqrt(gx ** 2 + gy ** 2)
    direction = np.arctan2(gy, gx)

    local_cx, local_cy = cx - x1, cy - y1
    yy, xx = np.mgrid[:region.shape[0], :region.shape[1]]
    dist_from_center = np.sqrt((xx - local_cx) ** 2 + (yy - local_cy) ** 2)

    ring_mask = (dist_from_center > r * 0.25) & (dist_from_center < r * 0.90)
    if np.sum(ring_mask) < 20:
        return 0.5

    expected_dir = np.arctan2(yy - local_cy, xx - local_cx)
    angle_diff = np.abs(direction - expected_dir)
    angle_diff = np.minimum(angle_diff, 2 * np.pi - angle_diff)

    strong_grad = mag > np.percentile(mag[ring_mask], 55) if np.any(ring_mask) else np.zeros_like(mag, dtype=bool)
    valid_mask = ring_mask & strong_grad

    if np.sum(valid_mask) < 10:
        return 0.5

    weighted = mag[valid_mask] * (1.0 - angle_diff[valid_mask] / np.pi)
    total_mag = np.sum(mag[valid_mask])

    if total_mag < 1e-6:
        return 0.5

    return float(np.clip(np.sum(weighted) / total_mag, 0.0, 1.0))


# ============================================================================
# STEP 6: CANDIDATE VALIDATION
# ============================================================================

def _validate_coconut_crown(
    image: np.ndarray,
    canopy_mask: np.ndarray,
    cx: int,
    cy: int,
    peak_distance: float,
    spacing_radius: int,
    min_radius: int = 8,
    max_radius: int = 250,
) -> Optional[Dict]:
    """
    Validate a candidate center using contour shape + radial texture.
    """
    h, w = image.shape[:2]

    est_radius = int(np.clip(peak_distance * 2.2, min_radius, max_radius))

    # blend distance-based radius and plantation-spacing radius
    est_radius = int(0.45 * est_radius + 0.55 * spacing_radius)
    est_radius = max(min_radius, min(est_radius, max_radius))

    r = min(est_radius + 12, max_radius + 12)
    y1, y2 = max(0, cy - r), min(h, cy + r)
    x1, x2 = max(0, cx - r), min(w, cx + r)

    if (x2 - x1) < 15 or (y2 - y1) < 15:
        return None

    region_mask = canopy_mask[y1:y2, x1:x2].copy()
    contours, _ = cv2.findContours(region_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    local_cx, local_cy = cx - x1, cy - y1
    best_cnt = None
    best_score = -1.0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 25:
            continue

        M = cv2.moments(cnt)
        if M["m00"] <= 1e-6:
            continue

        mcx = int(M["m10"] / M["m00"])
        mcy = int(M["m01"] / M["m00"])
        dist_to_center = ((mcx - local_cx) ** 2 + (mcy - local_cy) ** 2) ** 0.5

        # prefer contour containing / near the candidate center
        bx, by, bw, bh = cv2.boundingRect(cnt)
        contains_center = (bx <= local_cx <= bx + bw) and (by <= local_cy <= by + bh)
        score = (20.0 if contains_center else 0.0) - dist_to_center + area * 0.002

        if score > best_score:
            best_score = score
            best_cnt = cnt

    if best_cnt is None:
        return None

    area = cv2.contourArea(best_cnt)
    if area < np.pi * min_radius * min_radius * MIN_CONTOUR_AREA_FACTOR:
        return None

    perimeter = cv2.arcLength(best_cnt, True)
    circularity = (4 * np.pi * area) / max(perimeter * perimeter, 1.0)
    if circularity < MIN_CIRCULARITY:
        return None

    hull = cv2.convexHull(best_cnt)
    hull_area = cv2.contourArea(hull)
    solidity = area / max(hull_area, 1.0)
    if solidity < MIN_SOLIDITY:
        return None

    bx, by, bw, bh = cv2.boundingRect(best_cnt)
    aspect = bw / max(bh, 1)
    if aspect < 0.25 or aspect > 4.0:
        return None

    radial_score = _analyze_radial_pattern(image, cx, cy, est_radius)
    if radial_score < MIN_RADIAL_SCORE:
        return None

    size_score = min(1.0, area / (np.pi * max(spacing_radius, 8) * max(spacing_radius, 8)))
    peak_score = min(1.0, peak_distance / max(spacing_radius * 0.45, 1.0))

    confidence = (
        circularity * 0.22 +
        solidity * 0.20 +
        radial_score * 0.32 +
        size_score * 0.16 +
        peak_score * 0.10
    )

    if confidence < MIN_CONFIDENCE:
        return None

    radius = max(8, int(0.5 * est_radius + 0.5 * max(bw, bh) / 2.0))

    return {
        "bbox": (max(0, cx - radius), max(0, cy - radius), radius * 2, radius * 2),
        "centroid": (cx, cy),
        "radius": int(radius),
        "confidence": float(confidence),
        "area": int(np.pi * radius * radius),
        "circularity": float(circularity),
        "solidity": float(solidity),
        "radial_score": float(radial_score),
    }


# ============================================================================
# STEP 7: NMS / DEDUP
# ============================================================================

def _nms_detections(detections: List[Dict], min_centroid_dist: int) -> List[Dict]:
    """
    Remove duplicates so each crown keeps one best detection.
    """
    if len(detections) <= 1:
        return detections

    detections = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    kept: List[Dict] = []

    for det in detections:
        cx, cy = det["centroid"]
        r1 = det["radius"]
        duplicate = False

        for k in kept:
            kx, ky = k["centroid"]
            r2 = k["radius"]

            dist = ((cx - kx) ** 2 + (cy - ky) ** 2) ** 0.5
            adaptive_min_dist = max(min_centroid_dist, int(min(r1, r2) * 0.9))

            if dist < adaptive_min_dist:
                duplicate = True
                break

            x1, y1, w1, h1 = det["bbox"]
            x2, y2, w2, h2 = k["bbox"]

            ix1, iy1 = max(x1, x2), max(y1, y2)
            ix2, iy2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            union = w1 * h1 + w2 * h2 - inter

            if union > 0 and (inter / union) > NMS_IOU_THRESH:
                duplicate = True
                break

        if not duplicate:
            kept.append(det)

    return kept


# ============================================================================
# STEP 8: FINAL VALIDATION
# ============================================================================

def _final_validation(detections: List[Dict], image_area: int) -> List[Dict]:
    """
    Remove obvious false positives after NMS.
    """
    min_area = max(FINAL_MIN_AREA_FLOOR, int(image_area * FINAL_MIN_AREA_FRAC))
    max_area = int(image_area * FINAL_MAX_AREA_FRAC)

    validated: List[Dict] = []
    for det in detections:
        area = det.get("area", 0)
        radius = det.get("radius", 0)
        conf = det.get("confidence", 0.0)
        radial = det.get("radial_score", 0.0)
        circularity = det.get("circularity", 0.0)
        solidity = det.get("solidity", 0.0)

        if area < min_area:
            continue
        if area > max_area:
            continue
        if radius < FINAL_MIN_RADIUS:
            continue
        if conf < FINAL_MIN_CONFIDENCE:
            continue
        if radial < FINAL_MIN_RADIAL:
            continue
        if circularity < FINAL_MIN_CIRCULARITY:
            continue
        if solidity < FINAL_MIN_SOLIDITY:
            continue

        validated.append(det)

    return validated


# ============================================================================
# PUBLIC API
# ============================================================================

def detect_coconut_trees(
    image: np.ndarray,
    conf: float = 0.12,
    verbose: bool = True,
) -> List[Dict]:
    """
    Detect coconut tree crowns from aerial drone imagery.

    Returns list of dicts:
      bbox, centroid, radius, confidence, area, circularity, solidity, radial_score
    """
    h, w = image.shape[:2]
    image_area = h * w

    if verbose:
        print(f"[TREE] Input: {w}x{h} ({image_area:,} pixels)")

    scale = 1.0
    if max(h, w) > MAX_EDGE:
        scale = MAX_EDGE / max(h, w)
        proc = cv2.resize(
            image,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA
        )
    else:
        proc = image.copy()

    proc_h, proc_w = proc.shape[:2]
    inv_scale = 1.0 / scale

    if verbose:
        print("[TREE] Step 1: Preprocessing...")
    enhanced = _preprocess(proc)

    if verbose:
        print("[TREE] Step 2: Canopy extraction...")
    canopy_mask = _extract_canopy_mask(enhanced)

    canopy_pct = 100.0 * np.count_nonzero(canopy_mask) / canopy_mask.size
    if verbose:
        print(f"[TREE] Canopy coverage: {canopy_pct:.1f}%")

    if verbose:
        print("[TREE] Step 3: Watershed splitting...")
    markers = _split_canopy_watershed(enhanced, canopy_mask)

    if verbose:
        print("[TREE] Step 4: Center finding...")
    centers = _find_crown_centers(canopy_mask, markers)
    if verbose:
        print(f"[TREE] Candidate centers: {len(centers)}")

    if not centers:
        return []

    # Estimate plantation spacing
    if len(centers) >= 3:
        dists = []
        for i, (cx1, cy1, _) in enumerate(centers):
            min_d = float("inf")
            for j, (cx2, cy2, _) in enumerate(centers):
                if i == j:
                    continue
                d = ((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2) ** 0.5
                if d < min_d:
                    min_d = d
            if min_d < float("inf"):
                dists.append(min_d)

        avg_spacing = float(np.median(dists)) if dists else 40.0
        spacing_radius = max(8, int(avg_spacing * SPACING_RADIUS_MULT))
    else:
        spacing_radius = max(12, int(min(proc_h, proc_w) * MIN_RADIUS_FALLBACK_FRAC))

    if verbose:
        print(f"[TREE] Estimated spacing radius: {spacing_radius}px")

    if verbose:
        print("[TREE] Step 5: Candidate validation...")
    detections: List[Dict] = []

    for cx, cy, peak_dist in centers:
        if canopy_mask[min(cy, proc_h - 1), min(cx, proc_w - 1)] == 0:
            continue

        det = _validate_coconut_crown(
            enhanced,
            canopy_mask,
            cx,
            cy,
            peak_dist,
            spacing_radius=spacing_radius,
            min_radius=max(6, int(spacing_radius * 0.6)),
            max_radius=max(35, int(spacing_radius * 2.3)),
        )

        if det is None:
            continue
        if det["confidence"] < conf:
            continue

        if scale < 1.0:
            dcx = int(det["centroid"][0] * inv_scale)
            dcy = int(det["centroid"][1] * inv_scale)
            dr = int(det["radius"] * inv_scale)
            dr = max(8, dr)

            det["centroid"] = (dcx, dcy)
            det["radius"] = dr
            det["bbox"] = (max(0, dcx - dr), max(0, dcy - dr), dr * 2, dr * 2)
            det["area"] = int(np.pi * dr * dr)

        detections.append(det)

    if verbose:
        print(f"[TREE] After validation: {len(detections)}")

    if verbose:
        print("[TREE] Step 6: NMS...")
    min_dist = max(NMS_MIN_DIST_FLOOR, int(spacing_radius * inv_scale * NMS_DIST_MULT))
    detections = _nms_detections(detections, min_centroid_dist=min_dist)
    if verbose:
        print(f"[TREE] After NMS: {len(detections)}")

    if verbose:
        print("[TREE] Step 7: Final validation...")
    detections = _final_validation(detections, image_area)
    if verbose:
        print(f"[TREE] Final detections: {len(detections)}")

    return detections