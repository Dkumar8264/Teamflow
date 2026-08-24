const Notification = require('../models/Notification');

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({
      success: true,
      notifications
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listNotifications
};
