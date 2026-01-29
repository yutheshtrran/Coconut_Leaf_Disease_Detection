#!/usr/bin/env python
"""
Quick diagnostics for the video analysis feature
Run from ml/ directory: python check_video_api.py
"""

import sys
import os
import json

# Setup path
ml_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ml_dir)
os.chdir(ml_dir)

print("=" * 70)
print("COCONUT LEAF DISEASE API - DIAGNOSTIC CHECK")
print("=" * 70)

# 1. Check file structure
print("\n1. Checking file structure...")
required_files = [
    "ai_api/predict_api.py",
    "ai_api/requirements.txt",
    "src/segmentation.py",
    "src/video_service.py",
    "src/inference.py",
    "src/utils.py",
    "config.yaml",
]

for f in required_files:
    path = os.path.join(ml_dir, f)
    status = "✓" if os.path.exists(path) else "✗"
    print(f"   {status} {f}")

# 2. Check Python packages
print("\n2. Checking Python packages...")
packages = [
    ("cv2", "OpenCV"),
    ("torch", "PyTorch"),
    ("numpy", "NumPy"),
    ("PIL", "Pillow"),
    ("yaml", "PyYAML"),
    ("flask", "Flask"),
    ("flask_cors", "Flask-CORS"),
]

missing_packages = []
for pkg_import, pkg_name in packages:
    try:
        __import__(pkg_import)
        print(f"   ✓ {pkg_name}")
    except ImportError:
        print(f"   ✗ {pkg_name} - MISSING")
        missing_packages.append(pkg_name)

# 3. Check ML modules
print("\n3. Checking ML modules...")
try:
    from src.segmentation import TreeSegmenter
    print("   ✓ TreeSegmenter")
except Exception as e:
    print(f"   ✗ TreeSegmenter - ERROR: {str(e)[:60]}")

try:
    from src.video_service import VideoAnalyzer
    print("   ✓ VideoAnalyzer")
except Exception as e:
    print(f"   ✗ VideoAnalyzer - ERROR: {str(e)[:60]}")

try:
    from src.utils import infer
    print("   ✓ infer function")
except Exception as e:
    print(f"   ✗ infer - ERROR: {str(e)[:60]}")

# 4. Check weights and config
print("\n4. Checking model files...")
files_to_check = [
    ("weights/best_model.pth", "Model weights"),
    ("config.yaml", "Configuration"),
    ("logs/disease_info.json", "Disease info"),
]

for filepath, desc in files_to_check:
    full_path = os.path.join(ml_dir, filepath)
    if os.path.exists(full_path):
        size = os.path.getsize(full_path)
        if size > 1024*1024:
            size_str = f"{size/(1024*1024):.1f}MB"
        else:
            size_str = f"{size/1024:.1f}KB"
        print(f"   ✓ {desc} ({size_str})")
    else:
        print(f"   ✗ {desc} - NOT FOUND")

# 5. API startup test
print("\n5. Testing API startup...")
try:
    from ai_api.predict_api import app, USE_FASTAPI, VIDEO_AVAILABLE, INFER_AVAILABLE
    
    framework = "FastAPI" if USE_FASTAPI else "Flask"
    print(f"   ✓ API initialized with {framework}")
    print(f"   ✓ Video analysis available: {VIDEO_AVAILABLE}")
    print(f"   ✓ Inference available: {INFER_AVAILABLE}")
    
    if not (VIDEO_AVAILABLE and INFER_AVAILABLE):
        print("\n   ⚠ WARNING: Not all features available!")
        if not VIDEO_AVAILABLE:
            print("      - Video analysis will not work")
        if not INFER_AVAILABLE:
            print("      - Image prediction will not work")

except Exception as e:
    print(f"   ✗ API startup failed: {e}")
    import traceback
    print("\n" + traceback.format_exc())

# 6. Summary
print("\n" + "=" * 70)
if missing_packages:
    print(f"⚠ Missing packages: {', '.join(missing_packages)}")
    print(f"   Install with: pip install -r ai_api/requirements.txt")
else:
    print("✓ All checks passed! API should be ready to run.")

print("\n📝 To start the API, run:")
print("   cd ml && python ai_api/run_server.py")
print("=" * 70)
