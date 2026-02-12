const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Report Identity
    reportId: {
        type: String,
        unique: true,
        required: true
    },
    
    // Farm Association
    farm: {
        type: String,
        required: true
    },
    
    // Report Details
    date: {
        type: Date,
        required: true
    },
    issue: {
        type: String,
        required: true
    },
    
    // Severity Information
    severity: {
        value: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        label: {
            type: String,
            required: true,
            enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL']
        }
    },
    
    // Status & Timestamps
    status: {
        type: String,
        enum: ['Pending', 'Finalized'],
        default: 'Pending'
    },
    
    // User Association
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Metadata
    description: {
        type: String,
        default: ''
    },
    images: [{
        type: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Report', reportSchema);