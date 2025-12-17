"""Simple test runner for ML inference.

Place one or more image files in `ml/uploads/sample_images/` and either:
 - start the FastAPI server at ML_SERVICE_URL (default http://127.0.0.1:8000) and this script will POST to /predict
 - or if the server is not available this script will call the local inference function `ml.src.inference.infer` for each image (requires model at ml/weights/best_model.pth)

Usage:
    python ml/ai_api/test/run_predict_test.py
"""
import os
import sys
from pathlib import Path
import requests

BASE = Path(__file__).resolve().parents[2]
IMAGES_DIR = BASE / 'uploads' / 'sample_images'
MODEL_PATH = BASE / 'weights' / 'best_model.pth'
ML_SERVICE = os.environ.get('ML_SERVICE_URL', 'http://127.0.0.1:8000')


def call_service(files):
    url = ML_SERVICE.rstrip('/') + '/predict'
    multipart = []
    opened = []
    try:
        for p in files:
            f = open(p, 'rb')
            opened.append(f)
            multipart.append(('files', (os.path.basename(p), f, 'image/jpeg')))
        resp = requests.post(url, files=multipart, timeout=60)
        resp.raise_for_status()
        print('Service response:')
        print(resp.json())
    finally:
        for f in opened:
            try:
                f.close()
            except Exception:
                pass


def call_local_infer(files):
    try:
        from ml.src.inference import infer
    except Exception as e:
        print('Local inference not available:', e)
        return

    if not MODEL_PATH.exists():
        print('Local model weights not found at', MODEL_PATH)
        return

    for p in files:
        try:
            res = infer(str(p), model_path=str(MODEL_PATH))
            print(p.name, '->', res)
        except Exception as e:
            print('Error on', p, e)


def main():
    if not IMAGES_DIR.exists():
        print('Images folder does not exist:', IMAGES_DIR)
        return

    images = [p for p in IMAGES_DIR.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png')]
    if not images:
        print('No images found in', IMAGES_DIR)
        print('Drop sample images into that folder and re-run this script.')
        return

    # Try calling the running ML service first
    try:
        call_service(images)
        return
    except Exception as e:
        print('ML service not reachable at', ML_SERVICE, '-', e)
        print('Falling back to local inference if available...')

    call_local_infer(images)


if __name__ == '__main__':
    main()
