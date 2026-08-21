const express = require('express');
const { sendInvitationEmail } = require('../services/emailService');

const router = express.Router();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post('/send', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const projectName = String(req.body.projectName || '').trim();

    if (!name || !isValidEmail(email) || !projectName) {
      return res.status(400).json({
        success: false,
        message: 'Name, valid email, and project name are required'
      });
    }

    const result = await sendInvitationEmail({ email, name, projectName });

    return res.status(200).json({
      success: true,
      message:
        result.mode === 'smtp'
          ? `Invitation email sent to ${email}`
          : `Invitation email preview generated for ${email}. Configure SMTP to send real email.`,
      email: {
        delivered: result.delivered,
        mode: result.mode,
        messageId: result.messageId,
        preview: result.mode === 'preview' ? result.message : undefined
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
