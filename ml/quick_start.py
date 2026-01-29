#!/usr/bin/env python
"""
Quick setup and run script for Video Analysis API
Run from ml/ directory: python quick_start.py
"""

import os
import sys
import subprocess
import platform

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def run_check():
    """Run diagnostic check"""
    print_header("Running Diagnostic Check")
    
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        # Check imports
        from src.segmentation import TreeSegmenter
        from src.video_service import VideoAnalyzer
        from src.utils import infer
        
        print("✓ All ML modules loaded successfully")
        
        # Check API
        from ai_api.predict_api import app, USE_FASTAPI, VIDEO_AVAILABLE, INFER_AVAILABLE
        
        framework = "FastAPI" if USE_FASTAPI else "Flask"
        print(f"✓ API initialized with {framework}")
        print(f"✓ Video analysis: {'Available' if VIDEO_AVAILABLE else 'UNAVAILABLE'}")
        print(f"✓ Image inference: {'Available' if INFER_AVAILABLE else 'UNAVAILABLE'}")
        
        if not (VIDEO_AVAILABLE and INFER_AVAILABLE):
            print("\n⚠ WARNING: Not all features are available!")
            print("   This may be due to missing dependencies or import errors.")
            return False
        
        return True
    
    except Exception as e:
        print(f"✗ Check failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def install_deps():
    """Install dependencies"""
    print_header("Installing Dependencies")
    
    try:
        pip_cmd = [sys.executable, "-m", "pip", "install", "-r", "ai_api/requirements.txt"]
        
        print("Running: pip install -r ai_api/requirements.txt")
        print("This may take a few minutes...\n")
        
        result = subprocess.run(pip_cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
        
        if result.returncode == 0:
            print("\n✓ Dependencies installed successfully")
            return True
        else:
            print("\n✗ Failed to install dependencies")
            return False
    
    except Exception as e:
        print(f"✗ Installation failed: {e}")
        return False

def start_api():
    """Start the API server"""
    print_header("Starting Video Analysis API")
    
    print("API Server starting on http://127.0.0.1:5000")
    print("\nEndpoints available:")
    print("  GET  /              - API info")
    print("  GET  /health        - Health check")
    print("  POST /predict       - Image analysis")
    print("  POST /analyze-video - Video analysis")
    print("\nPress Ctrl+C to stop the server\n")
    
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(ml_dir)
    
    try:
        # Try to run the server
        result = subprocess.run([sys.executable, "ai_api/run_server.py"])
        return result.returncode == 0
    except Exception as e:
        print(f"Failed to start server: {e}")
        return False

def main():
    print_header("Coconut Leaf Disease - Video Analysis API")
    
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(ml_dir)
    
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Video Analysis API Quick Start",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python quick_start.py check    # Run diagnostic check
  python quick_start.py install  # Install dependencies
  python quick_start.py run      # Start API server
  python quick_start.py           # Interactive mode (default)
        """
    )
    
    parser.add_argument('action', nargs='?', choices=['check', 'install', 'run', 'test'],
                       help='Action to perform (default: interactive)')
    
    args = parser.parse_args()
    
    if args.action == 'check' or (args.action is None and len(sys.argv) == 1):
        # Interactive mode or check
        success = run_check()
        if success and args.action is None:
            print("\n" + "=" * 70)
            response = input("\n✓ All checks passed! Start API server? (y/n): ").lower()
            if response == 'y':
                start_api()
    
    elif args.action == 'install':
        success = install_deps()
        if success:
            print("\nNow run: python quick_start.py run")
    
    elif args.action == 'run':
        # Check first
        if not run_check():
            print("\n✗ Pre-flight check failed!")
            print("   Run 'python quick_start.py install' to install dependencies")
            sys.exit(1)
        
        start_api()
    
    elif args.action == 'test':
        print_header("Testing Endpoints")
        
        import time
        import requests
        
        # Give user time to start API
        print("Make sure API is running on http://127.0.0.1:5000")
        print("Starting tests in 3 seconds...")
        time.sleep(3)
        
        try:
            # Test root endpoint
            print("\n1. Testing GET /")
            response = requests.get("http://127.0.0.1:5000/")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
            
            # Test health endpoint
            print("\n2. Testing GET /health")
            response = requests.get("http://127.0.0.1:5000/health")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
            
            print("\n✓ Basic tests passed!")
        
        except Exception as e:
            print(f"\n✗ Tests failed: {e}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nShutdown requested.")
        sys.exit(0)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
