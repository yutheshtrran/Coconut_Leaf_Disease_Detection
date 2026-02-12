const express = require('express');
const router = express.Router({ mergeParams: true });
const plotController = require('../controllers/plotController');
const auth = require('../middleware/authMiddleware');

// Protected routes - all require authentication
// Get all plots for a farm
router.get('/', auth, plotController.getFarmPlots);

// Add a new plot to a farm
router.post('/', auth, plotController.addPlot);

// Get a specific plot
router.get('/:plotId', auth, plotController.getPlotById);

// Update a plot
router.put('/:plotId', auth, plotController.updatePlot);

// Delete a plot
router.delete('/:plotId', auth, plotController.deletePlot);

module.exports = router;
