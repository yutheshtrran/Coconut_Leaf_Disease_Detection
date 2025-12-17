# ml/src/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from inference import predict
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "ml/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/predict", methods=["POST"])
def predict_api():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    result = predict(file_path)
    os.remove(file_path)  # cleanup

    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
