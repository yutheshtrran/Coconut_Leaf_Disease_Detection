from flask import Flask, request, jsonify, send_file  # Added send_file here
from flask_cors import CORS
import os
import traceback
import json
import sys

# Fix for importing from sibling directory (ml/reports/)
ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # Points to ml/
sys.path.append(ML_DIR)

# Now use absolute import (no ..)
from reports.report_generator import generate_dummy_report

# Existing imports
from inference import predict, load_config, load_class_names

app = Flask(__name__)
CORS(app)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', 'weights', 'best_model.pth'))
CONFIG_PATH = os.path.abspath(os.path.join(BASE_DIR, 'config.yaml'))
DISEASE_INFO_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', 'logs', 'disease_info.json'))

# Load class names from config
cfg = load_config(CONFIG_PATH)
CLASS_NAMES = load_class_names(cfg)

# Load disease remedies
DISEASE_INFO = {}
if os.path.exists(DISEASE_INFO_PATH):
    try:
        with open(DISEASE_INFO_PATH, 'r') as f:
            DISEASE_INFO = json.load(f)
    except Exception as e:
        print(f"[WARNING] Could not load disease_info.json: {e}")

if not os.path.exists(MODEL_PATH):
    print(f"[WARNING] Model not found at {MODEL_PATH}. Predictions will use fallback logic.")

@app.route('/predict', methods=['POST'])
def predict_api():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Save temporarily
        UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads")
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        # Call the correct function
        out = predict(file_path)

        os.remove(file_path)

        # Convert confidence to percentage for frontend display
        conf = out.get('confidence', 0.0)
        try:
            percentage = round(float(conf) * 100, 2)
        except Exception:
            percentage = None

        # Get disease name and info
        disease_name = out.get('disease', 'Unknown')
        disease_info = DISEASE_INFO.get(disease_name.lower(), {})
        remedy = disease_info.get('remedy', 'No remedy information available.')

        return jsonify({
            'success': True,
            'prediction': {
                'disease': disease_name,
                'confidence': conf,
                'percentage': percentage,
                'remedy': remedy,
                'description': disease_info.get('description', ''),
                'impact': disease_info.get('impact', '')
            },
            'all_diseases': CLASS_NAMES
        })

    except Exception as e:
        print("Exception during /predict:")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route("/report/view/<report_id>")
def view_report(report_id):
    pdf_path = generate_dummy_report(report_id)
    return send_file(pdf_path, mimetype="application/pdf")

@app.route("/report/download/<report_id>")
def download_report(report_id):
    pdf_path = generate_dummy_report(report_id)
    return send_file(pdf_path, as_attachment=True)

if __name__ == '__main__':
    print(f"Starting server on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
