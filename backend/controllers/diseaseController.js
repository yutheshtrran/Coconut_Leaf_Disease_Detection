const Disease = require('../models/Disease');
const { uploadToCloudinary } = require('../services/cloudinary'); 
const cloudinary = require('cloudinary').v2; // For deletes

exports.createDisease = async (req, res) => {
  const { name, description, impact, remedy } = req.body;

  if (!name || !description || !impact || !remedy) {
    return res.status(400).json({ message: 'All text fields are required' });
  }

  try {
    const existing = await Disease.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: 'Disease name exists' });
    }

    const samples = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer, file.originalname);
        samples.push(url);
      }
    }

    const newDisease = new Disease({ name: name.trim(), description, impact, remedy, samples });
    await newDisease.save();
    res.status(201).json({ message: 'Disease created', disease: newDisease });
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDisease = async (req, res) => {
  const { name, description, impact, remedy } = req.body;

  try {
    const disease = await Disease.findById(req.params.id);
    if (!disease) return res.status(404).json({ message: 'Not found' });

    if (name) disease.name = name.trim();
    if (description) disease.description = description;
    if (impact) disease.impact = impact;
    if (remedy) disease.remedy = remedy;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer, file.originalname);
        disease.samples.push(url);
      }
    }

    await disease.save();
    res.json({ message: 'Updated', disease });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDisease = async (req, res) => {
  try {
    const disease = await Disease.findById(req.params.id);
    if (!disease) return res.status(404).json({ message: 'Not found' });

    // Delete images from Cloudinary
    if (disease.samples.length > 0) {
      for (const url of disease.samples) {
        const publicId = url.split('/').slice(7).join('/').split('.')[0]; // Extract public_id (adjust if no folder)
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await Disease.deleteOne({ _id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get all diseases (sorted newest first)
 */
exports.getAllDiseases = async (req, res) => {
  try {
    const diseases = await Disease.find().sort({ createdAt: -1 });
    res.status(200).json(diseases);
  } catch (error) {
    console.error('Error fetching diseases:', error);
    res.status(500).json({ message: 'Error fetching diseases' });
  }
};

/**
 * Get a single disease by ID (for editing)
 */
exports.getDiseaseById = async (req, res) => {
  try {
    const disease = await Disease.findById(req.params.id);
    if (!disease) {
      return res.status(404).json({ message: 'Disease not found' });
    }
    res.status(200).json(disease);
  } catch (error) {
    console.error('Error fetching disease by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

