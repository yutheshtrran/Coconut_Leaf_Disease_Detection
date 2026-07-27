const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/droneDetectionController');

router.post('/',     auth, ctrl.save);
router.get('/',      auth, ctrl.list);
router.get('/:id',   auth, ctrl.getOne);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
