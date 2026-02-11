from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Ensure the ml/ directory (parent of ai_api) is on PYTHONPATH so we can import src.*
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.utils import infer

# Resolve model/config paths relative to the ml/ folder
MODEL_PATH = os.path.join(BASE_DIR, "weights", "best_model.pth")
CONFIG_PATH = os.path.join(BASE_DIR, "src", "config.yaml")

app = FastAPI(title="Coconut Leaf Disease Predictor API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Single image disease prediction endpoint"""
    try:
        contents = await file.read()
        result = infer(contents, model_path=MODEL_PATH, config_path=CONFIG_PATH)
        return result
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content={"error": str(e)},
            status_code=400
        )

@app.get("/")
def root():
    return {
        "message": "Coconut Leaf Disease Prediction API is running.",
        "endpoints": {
            "predict": "/predict (POST)"
        }
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
