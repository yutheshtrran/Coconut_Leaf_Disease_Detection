const axios = require('axios');

const INFERENCE_API_URL = 'http://localhost:5000/predict'; // Update with your actual API endpoint

async function getInference(imageData) {
    try {
        const response = await axios.post(INFERENCE_API_URL, {
            image: imageData
        });
        return response.data;
    } catch (error) {
        console.error('Error during inference:', error);
        throw new Error('Inference failed');
    }
}

module.exports = {
    getInference
};