const mongoose = require('mongoose');

const treeSchema = new mongoose.Schema({
  tree_id:            Number,
  cx_px:              Number,
  cy_px:              Number,
  x1: Number, y1: Number, x2: Number, y2: Number,
  confidence:         Number,
  disease:            String,
  disease_confidence: Number,
  all_detections:     mongoose.Schema.Types.Mixed,
  // Cloudinary reference for the crop image
  crop_url:           String,   // https://res.cloudinary.com/…
  crop_public_id:     String,   // for deletion
}, { _id: false });

const droneDetectionSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:      { type: String, default: '' },
  // Cloudinary reference for the orthomosaic map
  mapUrl:         { type: String },   // https://res.cloudinary.com/…
  mapPublicId:    { type: String },   // for deletion
  mapDims:    { w: Number, h: Number },
  treeCount:  { type: Number, default: 0 },
  trees:      [treeSchema],
  gps:        { lat: Number, lng: Number },
  sessionId:  { type: String },
  savedAt:    { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('DroneDetection', droneDetectionSchema);
