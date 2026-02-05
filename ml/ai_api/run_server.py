#!/usr/bin/env python
"""
API Server Launcher
Run from ml/ai_api directory: python run_server.py
"""

import sys
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if __name__ == "__main__":
    try:
        logger.info("Starting Coconut Leaf Disease API Server...")
        
        from predict_api import app, USE_FASTAPI
        
        if USE_FASTAPI:
            logger.info("Using FastAPI framework")
            import uvicorn
            uvicorn.run(app, host="127.0.0.1", port=5000, log_level="info")
        else:
            logger.info("Using Flask framework")
            app.run(host="127.0.0.1", port=5000, debug=False)
    
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
