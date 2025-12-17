const express = require('express');
const flightController = require('../controllers/flightController');

const router = express.Router();

// Route to get all flights
router.get('/', flightController.getAllFlights);

// Route to create a new flight
router.post('/', flightController.createFlight);

// Route to get a flight by ID
router.get('/:id', flightController.getFlightById);

// Route to update a flight by ID
router.put('/:id', flightController.updateFlight);

// Route to delete a flight by ID
router.delete('/:id', flightController.deleteFlight);

module.exports = router;