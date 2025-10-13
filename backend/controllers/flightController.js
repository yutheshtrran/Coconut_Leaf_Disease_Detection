// flightController.js

const DroneFlight = require('../models/DroneFlight');

// Get all drone flights
exports.getAllFlights = async (req, res) => {
    try {
        const flights = await DroneFlight.find();
        res.status(200).json(flights);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving flights', error });
    }
};

// Create a new drone flight
exports.createFlight = async (req, res) => {
    const newFlight = new DroneFlight(req.body);
    try {
        const savedFlight = await newFlight.save();
        res.status(201).json(savedFlight);
    } catch (error) {
        res.status(400).json({ message: 'Error creating flight', error });
    }
};

// Get a specific drone flight by ID
exports.getFlightById = async (req, res) => {
    try {
        const flight = await DroneFlight.findById(req.params.id);
        if (!flight) {
            return res.status(404).json({ message: 'Flight not found' });
        }
        res.status(200).json(flight);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving flight', error });
    }
};

// Update a drone flight by ID
exports.updateFlight = async (req, res) => {
    try {
        const updatedFlight = await DroneFlight.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedFlight) {
            return res.status(404).json({ message: 'Flight not found' });
        }
        res.status(200).json(updatedFlight);
    } catch (error) {
        res.status(400).json({ message: 'Error updating flight', error });
    }
};

// Delete a drone flight by ID
exports.deleteFlight = async (req, res) => {
    try {
        const deletedFlight = await DroneFlight.findByIdAndDelete(req.params.id);
        if (!deletedFlight) {
            return res.status(404).json({ message: 'Flight not found' });
        }
        res.status(200).json({ message: 'Flight deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting flight', error });
    }
};