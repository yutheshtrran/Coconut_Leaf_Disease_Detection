const Disease = require('../models/Disease');
const path = require('path');
const fs = require('fs');

/**
 * Create a new disease entry with optional sample images
 */
exports.createDisease = async (req, res) => {
  const { name, description, impact, remedy } = req.body;

  // Validate required text fields
  if (!name || !description || !impact || !remedy) {
    return res.status(400).json({ message: 'All text fields (name, description, impact, remedy) are required' });
  }

  try {
    // Prevent duplicate disease names
    const existing = await Disease.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: 'A disease with this name already exists' });
    }

    // Handle uploaded images – store only relative paths for static serving
    const samples = req.files
      ? req.files.map(file => `/uploads/diseases/${file.filename}`)
      : [];

    console.log('Uploaded files:', req.files ? req.files.map(f => f.filename) : 'None');
    
    const newDisease = new Disease({
      name: name.trim(),
      description,
      impact,
      remedy,
      samples,
    });

    await newDisease.save();

    res.status(201).json({
      message: 'Disease added successfully',
      disease: newDisease,
    });
  } catch (error) {
    console.error('Error creating disease:', error);
    res.status(500).json({ message: 'Server error while creating disease' });
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

/**
 * Update an existing disease (text fields + optional new images appended)
 */
exports.updateDisease = async (req, res) => {
  const { name, description, impact, remedy } = req.body;

  try {
    const disease = await Disease.findById(req.params.id);
    if (!disease) {
      return res.status(404).json({ message: 'Disease not found' });
    }

    // Update text fields if provided
    if (name) disease.name = name.trim();
    if (description) disease.description = description;
    if (impact) disease.impact = impact;
    if (remedy) disease.remedy = remedy;

    // Append new images if uploaded (does not replace existing ones)
    if (req.files && req.files.length > 0) {
      const newSamples = req.files.map(file => `/uploads/diseases/${file.filename}`);
      console.log('Uploaded files:', req.files ? req.files.map(f => f.filename) : 'None');
      disease.samples = [...disease.samples, ...newSamples];
    }

    await disease.save();

    res.status(200).json({
      message: 'Disease updated successfully',
      disease,
    });
  } catch (error) {
    console.error('Error updating disease:', error);
    res.status(500).json({ message: 'Server error while updating disease' });
  }
};

/**
 * Delete a disease and optionally remove its sample images from disk
 */
exports.deleteDisease = async (req, res) => {
  try {
    const disease = await Disease.findByIdAndDelete(req.params.id);
    if (!disease) {
      return res.status(404).json({ message: 'Disease not found' });
    }

    // Clean up uploaded images from the filesystem
    if (disease.samples && disease.samples.length > 0) {
      disease.samples.forEach(sample => {
        const fullPath = path.join(__dirname, '..', sample); // sample is like "/uploads/diseases/xxx.jpg"
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`Deleted image: ${fullPath}`);
        }
      });
    }

    res.status(200).json({ message: 'Disease deleted successfully' });
  } catch (error) {
    console.error('Error deleting disease:', error);
    res.status(500).json({ message: 'Server error while deleting disease' });
  }
};