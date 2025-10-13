const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route to register a new user
router.post('/register', userController.register);

// Route to login a user
router.post('/login', userController.login);

// Route to get user profile
router.get('/profile', userController.getProfile);

// Route to update user profile
router.put('/profile', userController.updateProfile);

// Route to delete user account
router.delete('/account', userController.deleteAccount);

module.exports = router;