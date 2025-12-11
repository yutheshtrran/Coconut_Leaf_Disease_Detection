const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const upload = require('../services/storageService');

// Public: register/login still available here but app uses auth routes primarily
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Protected: profile operations
router.get('/profile', auth, userController.getUserProfile);
router.put('/profile', auth, userController.updateUserProfile);
router.post('/profile/photo', auth, upload.single('profilePhoto'), userController.uploadProfilePhoto);
router.delete('/profile/photo', auth, userController.deleteProfilePhoto);
router.put('/security', auth, userController.updateUserSecurity);
router.delete('/account', auth, userController.deleteUserAccount);

// Admin: list users
router.get('/', auth, requireRole('admin'), userController.listUsers);
router.put('/:id', auth, requireRole('admin'), userController.adminUpdateUser);
router.put('/promote', auth, requireRole('admin'), userController.adminPromoteByEmail);
router.delete('/:id/admin', auth, requireRole('admin'), userController.adminDeleteUser);

module.exports = router;