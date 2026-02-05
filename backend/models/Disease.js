const mongoose = require('mongoose');

const diseaseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  impact: {
    type: String,
    required: true,
  },
  remedy: {
    type: String,
    required: true,
  },
  samples: {
    type: [String], // Array of image paths
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Disease', diseaseSchema);