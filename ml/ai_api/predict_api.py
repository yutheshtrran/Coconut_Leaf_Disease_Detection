import sys
import os
import tempfile
import json
import traceback

# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from fastapi import FastAPI, UploadFile, File
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    USE_FASTAPI = True
except ImportError:
    USE_FASTAPI = False
    from flask import Flask, request, jsonify
    from flask_cors import CORS

# Import ML modules
try:
    from src.utils import infer
    INFER_AVAILABLE = True
except Exception as e:
    print(f"Warning: Could not import infer: {e}")
    INFER_AVAILABLE = False

try:
    from src.video_service import VideoAnalyzer
    VIDEO_AVAILABLE = True
except Exception as e:
    print(f"Warning: Could not import VideoAnalyzer: {e}")
    VIDEO_AVAILABLE = False
    traceback.print_exc()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "weights", "best_model.pth")
# Point CONFIG_PATH to src/config.yaml (absolute within ml/)
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "config.yaml")

# Initialize app based on available framework
if USE_FASTAPI:
    app = FastAPI(title="Coconut Leaf Disease Predictor API")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    
    @app.post("/predict")
    async def predict(file: UploadFile = File(...)):
        """Single image disease prediction endpoint"""
        try:
            if not INFER_AVAILABLE:
                return JSONResponse(
                    content={"error": "Inference module not available"},
                    status_code=500
                )
            contents = await file.read()
            result = infer(contents, model_path=MODEL_PATH, config_path=CONFIG_PATH)
            return result
        except Exception as e:
            return JSONResponse(
                content={"error": str(e)},
                status_code=400
            )
    
    @app.post("/analyze-video")
    async def analyze_video(file: UploadFile = File(...)):
        """Video analysis endpoint for tree detection and segmentation"""
        try:
            if not VIDEO_AVAILABLE:
                return JSONResponse(
                    content={"error": "Video analysis module not available"},
                    status_code=500
                )
            
            # Save uploaded file to temporary location
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
                content = await file.read()
                tmp.write(content)
                tmp_path = tmp.name
            
            try:
                # Analyze video
                analyzer = VideoAnalyzer(CONFIG_PATH)
                results = analyzer.analyze_video(tmp_path, max_frames=30)
                
                return JSONResponse(content=results, status_code=200)
            
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass
        
        except Exception as e:
            print(f"Error in analyze_video: {e}")
            traceback.print_exc()
            return JSONResponse(
                content={"error": str(e), "status": "failed"},
                status_code=400
            )
    
    @app.get("/")
    def root():
        return {
            "message": "Coconut Leaf Disease Prediction API is running.",
            "endpoints": {
                "predict": "/predict (POST)",
                "analyze_video": "/analyze-video (POST)"
            }
        }
    
    @app.get("/health")
    def health():
        return {
            "status": "healthy",
            "infer_available": INFER_AVAILABLE,
            "video_available": VIDEO_AVAILABLE
        }

else:
    # Fallback to Flask
    app = Flask(__name__)
    CORS(app)
    
    @app.route("/predict", methods=["POST"])
    def predict():
        """Single image disease prediction endpoint"""
        try:
            if not INFER_AVAILABLE:
                return jsonify({"error": "Inference module not available"}), 500
            
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            
            file = request.files['file']
            contents = file.read()
            result = infer(contents, model_path=MODEL_PATH, config_path=CONFIG_PATH)
            return jsonify(result)
        
        except Exception as e:
            return jsonify({"error": str(e)}), 400
    
    @app.route("/analyze-video", methods=["POST"])
    def analyze_video():
        """Video analysis endpoint for tree detection and segmentation"""
        try:
            if not VIDEO_AVAILABLE:
                return jsonify({"error": "Video analysis module not available"}), 500
            
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            
            file = request.files['file']
            
            # Save uploaded file to temporary location
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
                tmp.write(file.read())
                tmp_path = tmp.name
            
            try:
                # Analyze video
                analyzer = VideoAnalyzer(CONFIG_PATH)
                results = analyzer.analyze_video(tmp_path, max_frames=30)
                
                return jsonify(results), 200
            
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass
        
        except Exception as e:
            print(f"Error in analyze_video: {e}")
            traceback.print_exc()
            return jsonify({"error": str(e), "status": "failed"}), 400
    
    @app.route("/", methods=["GET"])
    def root():
        return jsonify({
            "message": "Coconut Leaf Disease Prediction API is running.",
            "endpoints": {
                "predict": "/predict (POST)",
                "analyze_video": "/analyze-video (POST)"
            }
        })
    
    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "healthy",
            "infer_available": INFER_AVAILABLE,
            "video_available": VIDEO_AVAILABLE
        })
