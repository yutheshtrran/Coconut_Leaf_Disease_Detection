from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import traceback
import json
import sys

# ------------------------------------------------------------------
# Fix Python path so ml/ and ml/reports/ are importable
# ------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))   # ml/src
ML_DIR = os.path.dirname(BASE_DIR)                      # ml
sys.path.append(ML_DIR)

from reports.report_generator import generate_dummy_report
from inference import predict, load_config, load_class_names

# ------------------------------------------------------------------
# Flask setup
# ------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

# ------------------------------------------------------------------
# Paths (ABSOLUTE & CORRECT)
# ------------------------------------------------------------------
MODEL_PATH = os.path.join(ML_DIR, "weights", "best_model.pth")
CONFIG_PATH = os.path.join(BASE_DIR, "config.yaml")
DISEASE_INFO_PATH = os.path.join(ML_DIR, "logs", "disease_info.json")

print("✅ MODEL PATH:", MODEL_PATH)

# ------------------------------------------------------------------
# Load config & class names
# ------------------------------------------------------------------
cfg = load_config(CONFIG_PATH)
CLASS_NAMES = load_class_names(cfg)

print("✅ Number of classes:", len(CLASS_NAMES))
print("✅ Classes:", CLASS_NAMES)

# ------------------------------------------------------------------
# Load disease info (remedies, descriptions)
# ------------------------------------------------------------------
DISEASE_INFO = {}
if os.path.exists(DISEASE_INFO_PATH):
    try:
        with open(DISEASE_INFO_PATH, "r") as f:
            DISEASE_INFO = json.load(f)
    except Exception as e:
        print(f"[WARNING] Could not load disease_info.json: {e}")

# ------------------------------------------------------------------
# Check model existence
# ------------------------------------------------------------------
if not os.path.exists(MODEL_PATH):
    print(f"[ERROR] Model NOT found at {MODEL_PATH}")
else:
    print("✅ Model file found")

# ------------------------------------------------------------------
# Prediction API
# ------------------------------------------------------------------
@app.route("/predict", methods=["POST"])
def predict_api():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        # Save image temporarily
        upload_dir = os.path.join(ML_DIR, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        img_path = os.path.join(upload_dir, file.filename)
        file.save(img_path)

        # Run inference (uses correct model internally)
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

# ------------------------------------------------------------------
# Report routes
# ------------------------------------------------------------------
@app.route("/report/view/<report_id>")
def view_report(report_id):
    pdf_path = generate_dummy_report(report_id)
    return send_file(pdf_path, mimetype="application/pdf")

@app.route("/report/download/<report_id>")
def download_report(report_id):
    pdf_path = generate_dummy_report(report_id)
    return send_file(pdf_path, as_attachment=True)

# ------------------------------------------------------------------
# Run app
# ------------------------------------------------------------------
if __name__ == "__main__":
    print("🚀 Starting server on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
