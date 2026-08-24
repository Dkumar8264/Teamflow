const express = require('express');
const { listNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(listNotifications);

module.exports = router;
