const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Basic rate limiter for auth endpoints
const authLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 10,
	message: { message: 'Too many requests, please try again later.' },
});

router.post('/register', authLimiter, authController.startRegister);
router.post('/register/confirm', authLimiter, authController.confirmRegister);
router.post('/register/resend', authLimiter, authController.resendPendingCode);
router.post('/verification-status', authController.verificationStatus);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.me);
router.post('/forgot', authController.forgotPassword);
router.post('/forgot/confirm', authController.forgotConfirm);
router.post('/reset', authController.resetPassword);
router.post('/verify', authController.verifyEmail);
router.post('/resend', authController.resendVerification);

module.exports = router;
