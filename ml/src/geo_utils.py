#!/usr/bin/env python3
"""
Geolocation Utilities for Drone Image / Video Pipeline

Two GPS extraction strategies:
  1. EXIF extraction (for uploaded images that have GPS metadata)
  2. OCR extraction (for drone video frames with GPS overlay text)

Plus common operations:
  - Haversine distance
  - Deduplication by proximity
  - Geographic sorting for optimal stitch order
  - Metadata summary generation
"""

import math
import re
import os
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple

# ---------------------------------------------------------------------------
# Lazy-loaded OCR reader (easyocr is heavy — only import when needed)
# ---------------------------------------------------------------------------
_ocr_reader = None


def _get_ocr_reader():
    """Lazily initialise the EasyOCR reader (English only)."""
    global _ocr_reader
    if _ocr_reader is None:
        try:
            import easyocr
            _ocr_reader = easyocr.Reader(['en'], gpu=True, verbose=False)
            print("[GEO] EasyOCR reader initialised (GPU)" if _ocr_reader else "")
        except Exception as e:
            print(f"[GEO][WARN] EasyOCR init failed: {e}")
            try:
                import easyocr
                _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                print("[GEO] EasyOCR reader initialised (CPU fallback)")
            except Exception as e2:
                print(f"[GEO][ERROR] EasyOCR completely unavailable: {e2}")
    return _ocr_reader


# ═══════════════════════════════════════════════════════════════════════════
# 1. EXIF GPS Extraction (for uploaded images)
# ═══════════════════════════════════════════════════════════════════════════

def _dms_to_decimal(dms_tuple, ref: str) -> float:
    """Convert EXIF GPS DMS (degrees, minutes, seconds) to decimal degrees."""
    try:
        degrees = float(dms_tuple[0])
        minutes = float(dms_tuple[1])
        seconds = float(dms_tuple[2])
        decimal = degrees + minutes / 60.0 + seconds / 3600.0
        if ref in ('S', 'W'):
            decimal = -decimal
        return decimal
    except Exception:
        return None


def extract_gps_from_exif(image_path: str) -> Optional[Dict]:
    """
    Extract GPS coordinates from an image's EXIF data.

    Returns:
        dict with keys: lat, lon, alt (altitude, optional)
        or None if no GPS data found.
    """
    try:
        from PIL import Image
        from PIL.ExifTags import GPS as GPS_TAGS

        img = Image.open(image_path)
        exif_data = img._getexif()
        if not exif_data:
            return None

        # GPS IFD tag number is 34853
        gps_info = exif_data.get(34853)
        if not gps_info:
            return None

        # Extract latitude
        lat_dms = gps_info.get(2)   # GPSLatitude
        lat_ref = gps_info.get(1)   # GPSLatitudeRef  ('N' or 'S')
        lon_dms = gps_info.get(4)   # GPSLongitude
        lon_ref = gps_info.get(3)   # GPSLongitudeRef ('E' or 'W')

        if not lat_dms or not lon_dms:
            return None

        lat = _dms_to_decimal(lat_dms, lat_ref)
        lon = _dms_to_decimal(lon_dms, lon_ref)

        if lat is None or lon is None:
            return None

        # Altitude (optional)
        alt = None
        alt_val = gps_info.get(6)   # GPSAltitude
        if alt_val is not None:
            try:
                alt = float(alt_val)
                alt_ref = gps_info.get(5, 0)  # 0 = above sea level
                if alt_ref == 1:
                    alt = -alt
            except Exception:
                alt = None

        return {'lat': lat, 'lon': lon, 'alt': alt}

    except Exception as e:
        print(f"[GEO][WARN] EXIF extraction failed for {os.path.basename(image_path)}: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# 2. OCR GPS Extraction (for drone video frame overlays)
# ═══════════════════════════════════════════════════════════════════════════

# Common GPS text patterns found in drone OSD overlays
_GPS_PATTERNS = [
    # Decimal: "7.1234 80.5678" or "N 7.1234 E 80.5678" or "Lat: 7.1234 Lon: 80.5678"
    re.compile(
        r'(?:N|LAT[:\s]*)?\s*(-?\d{1,3}\.\d{3,8})\s*[,\s]+\s*(?:E|LON[:\s]*)?\s*(-?\d{1,3}\.\d{3,8})',
        re.IGNORECASE
    ),
    # DMS: 7°12'34.5"N 80°56'78.9"E
    re.compile(
        r"(\d{1,3})[°]\s*(\d{1,2})['\u2019]\s*(\d{1,2}(?:\.\d+)?)[\"″\u201D]\s*([NSEW])\s+"
        r"(\d{1,3})[°]\s*(\d{1,2})['\u2019]\s*(\d{1,2}(?:\.\d+)?)[\"″\u201D]\s*([NSEW])",
        re.IGNORECASE
    ),
    # Simple with N/S E/W suffix: "7.1234N 80.5678E"
    re.compile(
        r'(-?\d{1,3}\.\d{3,8})\s*([NS])\s+(-?\d{1,3}\.\d{3,8})\s*([EW])',
        re.IGNORECASE
    ),
]

# Altitude pattern
_ALT_PATTERN = re.compile(
    r'(?:ALT|H|ELE)[:\s]*(-?\d+(?:\.\d+)?)\s*(?:m|M|ft)?',
    re.IGNORECASE
)


def _parse_gps_from_text(text: str) -> Optional[Dict]:
    """Try to parse GPS coordinates from OCR text using multiple patterns."""
    if not text:
        return None

    # Clean up OCR noise
    text = text.replace('\n', ' ').replace('\r', ' ')

    # Try DMS pattern first (pattern index 1)
    m = _GPS_PATTERNS[1].search(text)
    if m:
        d1, m1, s1, r1, d2, m2, s2, r2 = m.groups()
        lat = float(d1) + float(m1) / 60 + float(s1) / 3600
        lon = float(d2) + float(m2) / 60 + float(s2) / 3600
        if r1.upper() == 'S':
            lat = -lat
        if r2.upper() == 'W':
            lon = -lon

        alt = None
        ma = _ALT_PATTERN.search(text)
        if ma:
            alt = float(ma.group(1))
        return {'lat': lat, 'lon': lon, 'alt': alt}

    # Try decimal with N/S E/W suffix (pattern index 2)
    m = _GPS_PATTERNS[2].search(text)
    if m:
        lat = float(m.group(1))
        if m.group(2).upper() == 'S':
            lat = -lat
        lon = float(m.group(3))
        if m.group(4).upper() == 'W':
            lon = -lon

        alt = None
        ma = _ALT_PATTERN.search(text)
        if ma:
            alt = float(ma.group(1))
        return {'lat': lat, 'lon': lon, 'alt': alt}

    # Try plain decimal (pattern index 0) — most common
    m = _GPS_PATTERNS[0].search(text)
    if m:
        lat = float(m.group(1))
        lon = float(m.group(2))

        # Sanity check: valid lat/lon ranges
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            alt = None
            ma = _ALT_PATTERN.search(text)
            if ma:
                alt = float(ma.group(1))
            return {'lat': lat, 'lon': lon, 'alt': alt}

    return None


def extract_gps_from_frame_ocr(frame: np.ndarray, strip_ratio: float = 0.15) -> Optional[Dict]:
    """
    Extract GPS coordinates from the OSD overlay at the bottom of a drone video frame.

    Args:
        frame: BGR numpy array (a video frame)
        strip_ratio: fraction of frame height to crop from the bottom (default 15%)

    Returns:
        dict with lat, lon, alt or None if extraction fails
    """
    reader = _get_ocr_reader()
    if reader is None:
        return None

    try:
        h, w = frame.shape[:2]

        # Crop the bottom strip where GPS overlay typically appears
        strip_h = int(h * strip_ratio)
        bottom_strip = frame[h - strip_h:h, :, :]

        # Preprocess for better OCR:
        # 1. Convert to grayscale
        gray = cv2.cvtColor(bottom_strip, cv2.COLOR_BGR2GRAY)

        # 2. Increase contrast with CLAHE
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # 3. Threshold to isolate white/light text on dark background
        _, thresh = cv2.threshold(enhanced, 180, 255, cv2.THRESH_BINARY)

        # 4. Also try inverted (dark text on light background)
        _, thresh_inv = cv2.threshold(enhanced, 80, 255, cv2.THRESH_BINARY_INV)

        # Try OCR on multiple preprocessed versions
        for img_variant in [bottom_strip, thresh, thresh_inv]:
            try:
                if len(img_variant.shape) == 2:
                    # Convert grayscale back to 3-channel for easyocr
                    img_variant = cv2.cvtColor(img_variant, cv2.COLOR_GRAY2BGR)

                results = reader.readtext(img_variant, detail=0, paragraph=True)
                full_text = ' '.join(results)

                gps_data = _parse_gps_from_text(full_text)
                if gps_data:
                    return gps_data
            except Exception:
                continue

        return None

    except Exception as e:
        print(f"[GEO][WARN] Frame OCR failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# 3. Common Geo Operations
# ═══════════════════════════════════════════════════════════════════════════

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Calculate the great-circle distance between two (lat, lon) pairs.

    Returns:
        Distance in meters.
    """
    R = 6_371_000  # Earth radius in meters
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def deduplicate_by_location(
    geo_items: List[Dict],
    threshold_meters: float = 5.0
) -> List[Dict]:
    """
    Remove images/frames taken at the same location (within threshold_meters).

    Args:
        geo_items: list of dicts, each with 'path', 'lat', 'lon' (and optional 'alt')
        threshold_meters: distance threshold — items closer than this are considered duplicates

    Returns:
        Deduplicated list (keeps the first occurrence per location cluster).
    """
    if not geo_items:
        return geo_items

    unique = [geo_items[0]]

    for item in geo_items[1:]:
        is_duplicate = False
        for kept in unique:
            dist = haversine_distance(
                (item['lat'], item['lon']),
                (kept['lat'], kept['lon'])
            )
            if dist < threshold_meters:
                is_duplicate = True
                break
        if not is_duplicate:
            unique.append(item)

    removed = len(geo_items) - len(unique)
    if removed > 0:
        print(f"[GEO] Deduplicated: {len(geo_items)} → {len(unique)} "
              f"(removed {removed} same-location duplicates, threshold={threshold_meters}m)")
    return unique


def sort_by_geography(geo_items: List[Dict]) -> List[Dict]:
    """
    Sort images/frames by geographic position using nearest-neighbor traversal.
    Starts from the westernmost (min longitude) point and greedily visits the
    nearest unvisited point, producing a spatial scan path.

    Args:
        geo_items: list of dicts with 'lat', 'lon'

    Returns:
        Spatially sorted list.
    """
    if len(geo_items) <= 2:
        return geo_items

    # Start from the westernmost point
    remaining = list(geo_items)
    start_idx = min(range(len(remaining)), key=lambda i: remaining[i]['lon'])
    ordered = [remaining.pop(start_idx)]

    while remaining:
        last = ordered[-1]
        best_idx = min(
            range(len(remaining)),
            key=lambda i: haversine_distance(
                (last['lat'], last['lon']),
                (remaining[i]['lat'], remaining[i]['lon'])
            )
        )
        ordered.append(remaining.pop(best_idx))

    print(f"[GEO] Sorted {len(ordered)} items by geographic position (nearest-neighbor)")
    return ordered


def crop_osd_strip(frame: np.ndarray, strip_ratio: float = 0.12) -> np.ndarray:
    """
    Remove the OSD overlay strip from the bottom of a drone video frame.
    This prevents the text overlay from interfering with stitching and segmentation.

    Args:
        frame: BGR numpy array
        strip_ratio: fraction of height to remove from bottom

    Returns:
        Cropped frame with bottom strip removed.
    """
    h = frame.shape[0]
    crop_h = int(h * (1.0 - strip_ratio))
    return frame[:crop_h, :, :]


def get_geo_metadata(geo_items: List[Dict]) -> Dict:
    """
    Generate a summary of geographic metadata.

    Args:
        geo_items: list of dicts with 'lat', 'lon', 'alt'

    Returns:
        Summary dict with bounding_box, center, num_locations, altitude_range,
        and per-item coordinates.
    """
    if not geo_items:
        return {}

    lats = [g['lat'] for g in geo_items]
    lons = [g['lon'] for g in geo_items]
    alts = [g['alt'] for g in geo_items if g.get('alt') is not None]

    metadata = {
        'num_locations': len(geo_items),
        'bounding_box': {
            'min_lat': min(lats),
            'max_lat': max(lats),
            'min_lon': min(lons),
            'max_lon': max(lons),
        },
        'center': {
            'lat': sum(lats) / len(lats),
            'lon': sum(lons) / len(lons),
        },
        'coordinates': [
            {'lat': g['lat'], 'lon': g['lon'], 'alt': g.get('alt')}
            for g in geo_items
        ],
    }

    if alts:
        metadata['altitude_range'] = {
            'min': min(alts),
            'max': max(alts),
            'mean': sum(alts) / len(alts),
        }

    return metadata


# ═══════════════════════════════════════════════════════════════════════════
# 4. High-Level Pipeline Helpers
# ═══════════════════════════════════════════════════════════════════════════

def extract_and_process_image_gps(image_paths: List[str], verbose: bool = True) -> Tuple[List[Dict], Dict]:
    """
    Extract GPS from EXIF for a list of images, deduplicate, and sort.

    Returns:
        (geo_items, geo_metadata)
        geo_items: list of dicts with 'path', 'lat', 'lon', 'alt'
        geo_metadata: summary dict

    If no images have GPS data, returns ([], {}).
    """
    geo_items = []
    no_gps_count = 0

    for path in image_paths:
        gps = extract_gps_from_exif(path)
        if gps:
            geo_items.append({
                'path': path,
                'lat': gps['lat'],
                'lon': gps['lon'],
                'alt': gps.get('alt'),
            })
        else:
            no_gps_count += 1

    if verbose:
        print(f"[GEO] Extracted GPS from {len(geo_items)}/{len(image_paths)} images "
              f"({no_gps_count} without GPS)")

    if not geo_items:
        return [], {}

    # Deduplicate
    geo_items = deduplicate_by_location(geo_items)

    # Sort by geography
    geo_items = sort_by_geography(geo_items)

    # Generate metadata
    metadata = get_geo_metadata(geo_items)

    return geo_items, metadata


def extract_and_process_video_frame_gps(
    frame_paths: List[str],
    sample_rate: int = 5,
    verbose: bool = True
) -> Tuple[List[Dict], Dict, bool]:
    """
    Extract GPS from video frame OSD overlays via OCR.

    For efficiency, only samples every `sample_rate`-th frame for OCR,
    then interpolates/assigns GPS to intermediate frames.

    Args:
        frame_paths: list of frame image file paths
        sample_rate: OCR every Nth frame (default: every 5th)
        verbose: whether to print progress

    Returns:
        (geo_items, geo_metadata, has_osd)
        geo_items: list of dicts with 'path', 'lat', 'lon', 'alt'
        geo_metadata: summary dict
        has_osd: whether OSD GPS overlay was detected
    """
    if not frame_paths:
        return [], {}, False

    if verbose:
        print(f"[GEO] Scanning {len(frame_paths)} frames for GPS overlay "
              f"(sampling every {sample_rate}th frame)...")

    # Sample frames for OCR
    sampled_indices = list(range(0, len(frame_paths), sample_rate))
    sampled_gps = {}  # index -> gps dict

    for idx in sampled_indices:
        frame = cv2.imread(frame_paths[idx])
        if frame is None:
            continue

        gps = extract_gps_from_frame_ocr(frame)
        if gps:
            sampled_gps[idx] = gps

    gps_count = len(sampled_gps)
    if verbose:
        print(f"[GEO] OCR found GPS in {gps_count}/{len(sampled_indices)} sampled frames")

    if gps_count == 0:
        return [], {}, False

    # Build geo_items: assign GPS to each frame via nearest sampled frame
    geo_items = []
    sampled_sorted = sorted(sampled_gps.keys())

    for i, path in enumerate(frame_paths):
        # Find the nearest sampled frame with GPS
        nearest_idx = min(sampled_sorted, key=lambda si: abs(si - i))
        gps = sampled_gps[nearest_idx]
        geo_items.append({
            'path': path,
            'lat': gps['lat'],
            'lon': gps['lon'],
            'alt': gps.get('alt'),
        })

    # Deduplicate
    geo_items = deduplicate_by_location(geo_items)

    # Sort by geography
    geo_items = sort_by_geography(geo_items)

    # Generate metadata
    metadata = get_geo_metadata(geo_items)

    return geo_items, metadata, True
