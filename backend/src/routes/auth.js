const express = require('express');
const {
  forgotPassword,
  getMe,
  googleSignIn,
  login,
  logout,
  refreshSession,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  loginLimiter,
  signupLimiter,
  googleLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  resendVerificationLimiter,
  refreshLimiter
} = require('../middleware/rateLimit');

const router = express.Router();

// Public. Every one of these is rate limited: they either accept credentials or
// trigger an outbound email, and both are abusable.
router.post('/signup', signupLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/google', googleLimiter, googleSignIn);
router.post('/refresh-token', refreshLimiter, refreshSession);
router.post('/logout', logout);
router.post('/verify-email', resetPasswordLimiter, verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

// Authenticated.
router.get('/me', protect, getMe);

module.exports = router;
