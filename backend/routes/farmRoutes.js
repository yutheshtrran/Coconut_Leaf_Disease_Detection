const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController');
const auth = require('../middleware/authMiddleware');

// Protected routes - all require authentication
router.post('/', auth, farmController.addFarm);
router.get('/', auth, farmController.getUserFarms);
router.get('/:farmId', auth, farmController.getFarmById);
router.put('/:farmId', auth, farmController.updateFarm);
router.delete('/:farmId', auth, farmController.deleteFarm);

module.exports = router;
