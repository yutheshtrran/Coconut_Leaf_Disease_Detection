from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from src.utils import infer

app = FastAPI(title="Coconut Leaf Disease Predictor API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODEL_PATH = "weights/best_model.pth"
CONFIG_PATH = "config.yaml"

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    result = infer(contents, model_path=MODEL_PATH, config_path=CONFIG_PATH)
    return result

@app.get("/")
def root():
    return {"message": "Coconut Leaf Disease Prediction API is running."}
