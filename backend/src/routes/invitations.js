const express = require('express');
const Invitation = require('../models/Invitation');
const { getAccessibleProject } = require('../controllers/projectController');
const { protect } = require('../middleware/auth');
const { sendInvitationEmail } = require('../services/emailService');

const router = express.Router();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.use(protect);

router.post('/send', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const projectId = req.body.projectId;
    const fallbackProjectName = String(req.body.projectName || '').trim();

    if (!name || !isValidEmail(email) || (!projectId && !fallbackProjectName)) {
      return res.status(400).json({
        success: false,
        message: 'Name, valid email, and project are required'
      });
    }

    const project = projectId ? await getAccessibleProject(projectId, req.user, { requireOwner: true }) : null;
    const projectName = project?.name || fallbackProjectName;
    const result = await sendInvitationEmail({ email, name, projectName });
    const invitation = project
      ? await Invitation.create({
          project: project._id,
          invitedBy: req.user._id,
          name,
          email,
          role: req.body.role || 'member',
          message: `You got an invitation to join ${projectName} on TeamFlow.`,
          emailMode: result.mode,
          emailMessageId: result.messageId || ''
        })
      : null;

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
      },
      invitation
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
