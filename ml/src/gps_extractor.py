"""
DJI drone video GPS extractor.

DJI Mavic3Pro (and similar DJI drones) embed per-frame GPS coordinates
in the proprietary `djmd` protobuf stream (stream index 1).

Each GPS record starts with the 3-byte pattern 0x0A 0x12 0x11 followed
by an 8-byte little-endian double (latitude in radians) then byte 0x19
followed by another 8-byte little-endian double (longitude in radians).

Average across all valid frames gives the farm-centre coordinate.
"""

import math
import struct
import subprocess
import os


def extract_dji_gps(video_path: str) -> dict | None:
    """
    Extract average GPS coordinates from a DJI drone video.

    Returns:
        { 'lat': float, 'lon': float, 'point_count': int, 'source': 'djmd' }
        or None if GPS data is unavailable or extraction fails.
    """
    if not os.path.isfile(video_path):
        return None

    try:
        # Extract the djmd metadata stream as raw bytes via ffmpeg
        result = subprocess.run(
            ['ffmpeg', '-i', video_path, '-map', '0:1', '-c', 'copy',
             '-f', 'rawvideo', 'pipe:1'],
            capture_output=True,
            timeout=60,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(f'[GPS] ffmpeg unavailable or timed out: {exc}')
        return None

    data = result.stdout
    if not data:
        print('[GPS] djmd stream empty — video may not contain DJI metadata')
        return None

    # Scan for the per-frame GPS protobuf pattern:
    #   0x0A 0x12 0x11  <8-byte LE double: lat_rad>  0x19  <8-byte LE double: lon_rad>
    HEADER = bytes([0x0A, 0x12, 0x11])
    lats, lons = [], []
    i = 0
    n = len(data)

    while i < n - 22:
        if data[i:i + 3] == HEADER and data[i + 11] == 0x19:
            lat_rad = struct.unpack_from('<d', data, i + 3)[0]
            lon_rad = struct.unpack_from('<d', data, i + 12)[0]
            lat_deg = math.degrees(lat_rad)
            lon_deg = math.degrees(lon_rad)
            if -90.0 < lat_deg < 90.0 and -180.0 < lon_deg < 180.0:
                lats.append(lat_deg)
                lons.append(lon_deg)
        i += 1

    if not lats:
        print('[GPS] No valid GPS points found in djmd stream')
        return None

    avg_lat = sum(lats) / len(lats)
    avg_lon = sum(lons) / len(lons)
    print(f'[GPS] Extracted {len(lats)} points: lat={avg_lat:.6f} lon={avg_lon:.6f}')

    return {
        'lat':         round(avg_lat, 7),
        'lon':         round(avg_lon, 7),
        'point_count': len(lats),
        'source':      'djmd',
    }
