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
    farmId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        default: null
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

    // Analysis results stored at report creation time
    analysisData: {
        analysisType: {
            type: String,
            enum: ['leaf', 'drone-image', 'drone-video'],
        },
        totalImages:    { type: Number },
        healthyPercent: { type: Number },
        diseases: [{
            name:          String,
            count:         Number,
            percentage:    Number,
            topConfidence: Number,
            description:   String,
            remedy:        String,
        }],
        treeSummary: {
            total:   Number,
            healthy: Number,
            atRisk:  Number,
        },
        annotatedImages: [{ type: String }],
        gps: {
            lat:    Number,
            lon:    Number,
            source: { type: String, enum: ['exif', 'video', 'manual', 'farm'] },
        },
        // Drone-video map + per-tree data
        mapImage:  { type: String },   // compressed JPEG data URL of the orthomosaic
        mapWidth:  { type: Number },   // natural pixel width of the original map
        mapHeight: { type: Number },   // natural pixel height of the original map
        treesForMap: [{                // lightweight tree positions for the map overlay
            tree_id: Number,
            cx_pct:  Number,           // cx_px / mapWidth * 100
            cy_pct:  Number,           // cy_px / mapHeight * 100
            disease: String,
        }],
        affectedTrees: [{              // diseased trees with their crop images
            tree_id:            Number,
            disease:            String,
            disease_confidence: Number,
            crop_image:         String,
        }],
        allTrees: [{                   // all trees (healthy + diseased) with crop images
            tree_id:            Number,
            disease:            String,
            disease_confidence: Number,
            crop_image:         String,
        }],
    },
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