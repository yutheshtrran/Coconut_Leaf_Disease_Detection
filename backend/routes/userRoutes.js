const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Public: register/login still available here but app uses auth routes primarily
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Protected: profile operations
router.get('/profile', auth, userController.getUserProfile);
router.put('/profile', auth, userController.updateUserProfile);
router.delete('/account', auth, userController.deleteUserAccount);

// Admin: list users
router.get('/', auth, requireRole('admin'), userController.listUsers);

module.exports = router;