#!/usr/bin/env python
"""
Manual test for the /analyze-video endpoint
Run with: python test_video_endpoint.py
"""

import requests
import os
import sys

BASE_URL = "http://127.0.0.1:5000"

def test_health():
    """Test health endpoint"""
    print("\n1. Testing /health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"   Error: {e}")
        return False

def test_analyze_video_mock():
    """Test /analyze-video endpoint with a mock video"""
    print("\n2. Testing /analyze-video endpoint...")
    
    # Create a simple test video using cv2
    try:
        import cv2
        import numpy as np
        
        # Create a temporary test video
        test_video_path = "test_video.mp4"
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(test_video_path, fourcc, 20.0, (640, 480))
        
        # Write 30 frames of random green-ish image
        for i in range(30):
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            # Add green channel to simulate plants
            frame[:, :, 1] = np.random.randint(100, 200)
            frame[100:200, 150:250] = [0, 150, 0]  # Add green blob
            frame[250:350, 350:450] = [0, 150, 0]  # Add another green blob
            out.write(frame)
        
        out.release()
        
        # Send to API
        print(f"   Uploading test video ({os.path.getsize(test_video_path) / 1024:.1f} KB)...")
        
        with open(test_video_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(f"{BASE_URL}/analyze-video", files=files)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        # Cleanup
        os.remove(test_video_path)
        
        return response.status_code == 200
    
    except Exception as e:
        print(f"   Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Video Analysis API")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✓ Server is responding: {response.json()}")
    except Exception as e:
        print(f"✗ Server is NOT responding: {e}")
        print(f"\nMake sure the API is running:")
        print(f"  cd ml && python ai_api/run_server.py")
        sys.exit(1)
    
    # Run tests
    health_ok = test_health()
    video_ok = test_analyze_video_mock()
    
    print("\n" + "=" * 60)
    print("Test Summary:")
    print(f"  Health check: {'✓ PASS' if health_ok else '✗ FAIL'}")
    print(f"  Video analysis: {'✓ PASS' if video_ok else '✗ FAIL'}")
    print("=" * 60)
