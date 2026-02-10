const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// All report routes require authentication
router.use(authMiddleware);

// Route to get all reports for authenticated user
router.get('/', reportController.getReports);

// Route to get filtered reports
router.get('/filter', reportController.getFilteredReports);

// Route to create a new report
router.post('/', reportController.createReport);

// Route to get a specific report by ID
router.get('/:id', reportController.getReportById);

// Route to update a report by ID
router.put('/:id', reportController.updateReport);

// Route to delete a report by ID
router.delete('/:id', reportController.deleteReport);

module.exports = router;