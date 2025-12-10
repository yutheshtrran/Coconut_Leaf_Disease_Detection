import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Adjust the base URL as needed
  headers: {
    'Content-Type': 'application/json',
  },
});

// Example API call to upload an image
export const uploadImage = async (formData) => {
  try {
    const response = await api.post('/upload', formData);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

// Example API call to get detection results
export const getDetectionResults = async (imageId) => {
  try {
    const response = await api.get(`/results/${imageId}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

// Example API call to get reports
export const getReports = async () => {
  try {
    const response = await api.get('/reports');
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export default api;