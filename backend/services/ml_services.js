const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// ML API endpoint - adjust port if needed
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001/predict';

/**
 * Send image files to ML API for prediction
 * @param {Array<string>} filePaths - Array of file paths to predict
 * @returns {Promise<Array>} Array of prediction results
 */
async function predict_images(filePaths) {
  const predictions = [];

  for (const filePath of filePaths) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post(ML_API_URL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30 second timeout
      });

      predictions.push({
        file: filePath,
        result: response.data,
      });
    } catch (error) {
      console.error(`ML prediction error for ${filePath}:`, error.message);
      predictions.push({
        file: filePath,
        error: error.message,
      });
    }
  }

  return predictions;
}

module.exports = {
  predict_images,
};
