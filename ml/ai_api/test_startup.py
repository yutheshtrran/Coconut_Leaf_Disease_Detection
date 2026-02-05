#!/usr/bin/env python
"""
Test script to verify API startup and health
Run from ml/ directory: python ai_api/test_startup.py
"""

import sys
import os

# Add ml directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

print("=" * 60)
print("Testing API Startup and Module Imports")
print("=" * 60)

print("\n1. Testing basic imports...")
try:
    import cv2
    print("   ✓ cv2 imported successfully")
except Exception as e:
    print(f"   ✗ cv2 import failed: {e}")

try:
    import torch
    print("   ✓ torch imported successfully")
except Exception as e:
    print(f"   ✗ torch import failed: {e}")

try:
    import numpy as np
    print("   ✓ numpy imported successfully")
except Exception as e:
    print(f"   ✗ numpy import failed: {e}")

print("\n2. Testing ML module imports...")
try:
    from src.segmentation import TreeSegmenter
    print("   ✓ TreeSegmenter imported successfully")
except Exception as e:
    print(f"   ✗ TreeSegmenter import failed: {e}")
    import traceback
    traceback.print_exc()

try:
    from src.video_service import VideoAnalyzer
    print("   ✓ VideoAnalyzer imported successfully")
except Exception as e:
    print(f"   ✗ VideoAnalyzer import failed: {e}")
    import traceback
    traceback.print_exc()

try:
    from src.utils import infer
    print("   ✓ infer function imported successfully")
except Exception as e:
    print(f"   ✗ infer import failed: {e}")
    import traceback
    traceback.print_exc()

print("\n3. Testing API framework...")
try:
    from fastapi import FastAPI
    print("   ✓ FastAPI available")
    USE_FASTAPI = True
except ImportError:
    print("   ✗ FastAPI not available, will use Flask")
    USE_FASTAPI = False

if not USE_FASTAPI:
    try:
        from flask import Flask
        print("   ✓ Flask available")
    except ImportError:
        print("   ✗ Flask also not available")

print("\n4. Testing API startup...")
try:
    # Import the app
    os.chdir(os.path.dirname(__file__))
    from predict_api import app, USE_FASTAPI, VIDEO_AVAILABLE, INFER_AVAILABLE
    
    print(f"   ✓ API loaded successfully")
    print(f"   - Using FastAPI: {USE_FASTAPI}")
    print(f"   - Video analysis available: {VIDEO_AVAILABLE}")
    print(f"   - Inference available: {INFER_AVAILABLE}")
    
except Exception as e:
    print(f"   ✗ API startup failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Startup test completed!")
print("=" * 60)
