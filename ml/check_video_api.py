#!/usr/bin/env python
"""
Quick setup, run, and API server for Coconut Leaf Disease Analysis
Run from ml/ directory: python quick_start.py
"""

import os
import sys
import subprocess
import argparse
import traceback
import json

# -----------------------------
# Helper Functions
# -----------------------------
def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def run_check():
    """Run pre-flight diagnostic check"""
    print_header("Running Diagnostic Check")
    try:
        # Ensure ML paths are importable
        BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
        ML_DIR = os.path.dirname(BASE_DIR)
        sys.path.insert(0, ML_DIR)

        # Check imports
        from inference import predict, load_config, load_class_names
        from reports.report_generator import generate_dummy_report

        print("✓ All ML modules loaded successfully")

        # Check model existence
        MODEL_PATH = os.path.join(ML_DIR, "weights", "best_model.pth")
        if os.path.exists(MODEL_PATH):
            print("✓ Model file exists")
            model_available = True
        else:
            print("⚠ Model file NOT found")
            model_available = False

        return model_available

    except Exception as e:
        print(f"✗ Check failed: {e}")
        traceback.print_exc()
        return False

def install_deps():
    """Install dependencies from requirements.txt"""
    print_header("Installing Dependencies")
    try:
        pip_cmd = [sys.executable, "-m", "pip", "install", "-r", "ai_api/requirements.txt"]
        print("Running: pip install -r ai_api/requirements.txt")
        result = subprocess.run(pip_cmd)
        if result.returncode == 0:
            print("\n✓ Dependencies installed successfully")
            return True
        else:
            print("\n✗ Failed to install dependencies")
            return False
    except Exception as e:
        print(f"✗ Installation failed: {e}")
        return False

# -----------------------------
# Flask API Setup
# -----------------------------
def start_api():
    print_header("Starting Video Analysis API (Flask)")

    from flask import Flask, request, jsonify, send_file
    from flask_cors import CORS
    import shutil

    BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
    ML_DIR = os.path.dirname(BASE_DIR)

    sys.path.insert(0, ML_DIR)

    from inference import predict, load_config, load_class_names
    from reports.report_generator import generate_dummy_report

    app = Flask(__name__)
    CORS(app)

    # Paths
    MODEL_PATH = os.path.join(ML_DIR, "weights", "best_model.pth")
    CONFIG_PATH = os.path.join(BASE_DIR, "config.yaml")
    DISEASE_INFO_PATH = os.path.join(ML_DIR, "logs", "disease_info.json")

    # Load config & class names
    cfg = load_config(CONFIG_PATH)
    CLASS_NAMES = load_class_names(cfg)

    # Load disease info
    DISEASE_INFO = {}
    if os.path.exists(DISEASE_INFO_PATH):
        try:
            with open(DISEASE_INFO_PATH, "r") as f:
                DISEASE_INFO = json.load(f)
        except Exception as e:
            print(f"[WARNING] Could not load disease_info.json: {e}")

    # -----------------------------
    # Health endpoint
    # -----------------------------
    @app.route("/health")
    def health():
        return jsonify({"status": "ok"})

    # -----------------------------
    # Prediction endpoint
    # -----------------------------
    @app.route("/predict", methods=["POST"])
    def predict_api():
        try:
            if "file" not in request.files:
                return jsonify({"error": "No file uploaded"}), 400
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "Empty filename"}), 400

            # Save temporary upload
            upload_dir = os.path.join(ML_DIR, "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            img_path = os.path.join(upload_dir, file.filename)
            file.save(img_path)

            # Run inference
            output = predict(img_path)
            os.remove(img_path)

            confidence = float(output.get("confidence", 0.0))
            percentage = round(confidence * 100, 2)
            disease = output.get("disease", "Unknown")
            disease_key = disease.lower()
            disease_info = DISEASE_INFO.get(disease_key, {})

            return jsonify({
                "success": True,
                "prediction": {
                    "disease": disease,
                    "confidence": confidence,
                    "percentage": percentage,
                    "description": disease_info.get("description", ""),
                    "impact": disease_info.get("impact", ""),
                    "remedy": disease_info.get("remedy", "No remedy available")
                },
                "all_diseases": CLASS_NAMES
            })

        except Exception as e:
            print("❌ Exception during /predict")
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500

    # -----------------------------
    # Report endpoints
    # -----------------------------
    @app.route("/report/view/<report_id>")
    def view_report(report_id):
        pdf_path = generate_dummy_report(report_id)
        return send_file(pdf_path, mimetype="application/pdf")

    @app.route("/report/download/<report_id>")
    def download_report(report_id):
        pdf_path = generate_dummy_report(report_id)
        return send_file(pdf_path, as_attachment=True)

    print("🚀 API Server running at http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)

# -----------------------------
# Endpoint Test
# -----------------------------
def test_endpoints():
    import requests
    import time

    print_header("Testing Endpoints")
    print("Make sure the API is running on http://127.0.0.1:5000")
    print("Starting tests in 3 seconds...")
    time.sleep(3)

    try:
        r = requests.get("http://127.0.0.1:5000/")
        print("GET / status:", r.status_code)
    except:
        print("GET / failed")

    try:
        r = requests.get("http://127.0.0.1:5000/health")
        print("GET /health status:", r.status_code)
        print("Response:", r.json())
    except Exception as e:
        print("GET /health failed:", e)

# -----------------------------
# Main
# -----------------------------
def main():
    parser = argparse.ArgumentParser(description="Quick Start for Video Analysis API")
    parser.add_argument('action', nargs='?', choices=['check', 'install', 'run', 'test'],
                        help='Action to perform')
    args = parser.parse_args()

    if args.action == 'check':
        run_check()
    elif args.action == 'install':
        install_deps()
    elif args.action == 'run':
        if not run_check():
            print("\n✗ Pre-flight check failed!")
            sys.exit(1)
        start_api()
    elif args.action == 'test':
        test_endpoints()
    else:
        # Interactive default
        if run_check():
            response = input("\n✓ All checks passed! Start API server? (y/n): ").lower()
            if response == 'y':
                start_api()
            else:
                print("Exiting.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nShutdown requested.")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)
