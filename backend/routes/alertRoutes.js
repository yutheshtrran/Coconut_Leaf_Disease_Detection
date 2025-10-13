const express = require('express');
const alertController = require('../controllers/alertController');

const router = express.Router();

// Route to get all alerts
router.get('/', alertController.getAllAlerts);

// Route to create a new alert
router.post('/', alertController.createAlert);

// Route to get a specific alert by ID
router.get('/:id', alertController.getAlertById);

// Route to update an alert by ID
router.put('/:id', alertController.updateAlert);

// Route to delete an alert by ID
router.delete('/:id', alertController.deleteAlert);

module.exports = router;