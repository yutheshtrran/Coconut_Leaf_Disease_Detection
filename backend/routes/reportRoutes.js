const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Route to get all reports
router.get('/', reportController.getAllReports);

// Route to create a new report
router.post('/', reportController.createReport);

// Route to get a specific report by ID
router.get('/:id', reportController.getReportById);

// Route to update a report by ID
router.put('/:id', reportController.updateReportById);

// Route to delete a report by ID
router.delete('/:id', reportController.deleteReportById);

module.exports = router;