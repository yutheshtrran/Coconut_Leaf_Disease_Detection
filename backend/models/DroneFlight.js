const mongoose = require('mongoose');

const droneFlightSchema = new mongoose.Schema({
    flightId: {
        type: String,
        required: true,
        unique: true
    },
    droneId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'], // 'location.type' must be 'Point'
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    images: [{
        type: String,
        required: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

droneFlightSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DroneFlight', droneFlightSchema);