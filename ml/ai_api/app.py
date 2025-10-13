from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import torch
from model import YourModelClass  # Replace with your actual model class

app = Flask(__name__)
CORS(app)

# Load your trained model
model = YourModelClass()
model.load_state_dict(torch.load('path/to/your/model.pth'))  # Update with your model path
model.eval()

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Read the image
    img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
    img = cv2.resize(img, (224, 224))  # Resize to match model input
    img = img / 255.0  # Normalize
    img = np.transpose(img, (2, 0, 1))  # Change data format to CxHxW
    img = torch.tensor(img).float().unsqueeze(0)  # Add batch dimension

    # Make prediction
    with torch.no_grad():
        output = model(img)
        prediction = torch.argmax(output, dim=1).item()

    return jsonify({'prediction': prediction})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)