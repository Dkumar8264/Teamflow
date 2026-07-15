const express = require('express');
const { getMe, login, refreshToken, signup } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);

module.exports = router;
