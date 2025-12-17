const path = require('path');
const fs = require('fs');
const mlServices = require('../services/ml_services');

exports.predict = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Collect file paths
    const files = req.files.map((f) => f.path);

    // Call ML service client
    const predictions = mlServices.predict_images(files);

    return res.status(200).json({ predictions });
  } catch (error) {
    console.error('ML predict error:', error);
    return res.status(500).json({ message: 'ML prediction failed', error: error.message });
  }
};
