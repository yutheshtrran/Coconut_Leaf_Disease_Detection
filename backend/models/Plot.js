const mongoose = require('mongoose');

const plotSchema = new mongoose.Schema({
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  area: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['LOW_RISK', 'MODERATE', 'CRITICAL'],
    default: 'LOW_RISK',
  },
  lastAnalyzed: {
    type: Date,
    default: null,
  },
  description: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
plotSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Plot', plotSchema);
