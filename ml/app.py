from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import traceback

# Import your inference pipeline
from src.inference import infer, load_config, load_class_names

from reports.report_generator import generate_dummy_report
from flask import send_file

app = Flask(__name__)
CORS(app)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', 'weights', 'best_model.pth'))
CONFIG_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', 'config.yaml'))

# Load class names from config
cfg = load_config(CONFIG_PATH)
CLASS_NAMES = load_class_names(cfg)

if not os.path.exists(MODEL_PATH):
    print(f"[WARNING] Model not found at {MODEL_PATH}. Predictions will use fallback logic.")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        content = file.read()
        out = infer(content, model_path=MODEL_PATH, config_path=CONFIG_PATH)

        return jsonify({
            'disease': out.get('predicted_class', 'Unknown'),
            'confidence': out.get('confidence', 0.0),
            'severity': out.get('severity_level', 'Low'),
            'raw_scores': out.get('raw_scores', []),
            'all_diseases': CLASS_NAMES  # Return all possible disease names
        })

    except Exception as e:
        print("Exception during /predict:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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
