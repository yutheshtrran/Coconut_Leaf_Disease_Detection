const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController');
const plotRoutes = require('./plotRoutes');
const auth = require('../middleware/authMiddleware');

// Protected routes - all require authentication
router.post('/', auth, farmController.addFarm);
router.get('/', auth, farmController.getUserFarms);
router.get('/:farmId', auth, farmController.getFarmById);
router.put('/:farmId', auth, farmController.updateFarm);
router.delete('/:farmId', auth, farmController.deleteFarm);

// Plot routes nested under farms
router.use('/:farmId/plots', plotRoutes);

module.exports = router;
