const express = require('express');
const router = express.Router();
const alertService = require('../services/smsService');

// Send an alert
router.post('/send', async (req, res) => {
    const { message, recipient } = req.body;

    try {
        await alertService.sendSms(message, recipient);
        res.status(200).json({ success: true, message: 'Alert sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send alert', error: error.message });
    }
});

// Get all alerts
router.get('/', async (req, res) => {
    try {
        // Logic to retrieve alerts from the database can be added here
        res.status(200).json({ success: true, alerts: [] }); // Placeholder for alerts
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve alerts', error: error.message });
    }
});

module.exports = router;