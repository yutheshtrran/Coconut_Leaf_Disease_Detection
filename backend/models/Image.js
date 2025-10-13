const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
    annotations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Annotation',
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    metadata: {
        type: Object,
        default: {},
    },
});

module.exports = mongoose.model('Image', imageSchema);