const nodemailer = require('nodemailer');

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

const buildInvitationEmail = ({ email, name, projectName }) => {
  const subject = `You got an invitation to join ${projectName} on TeamFlow`;
  const text = [
    `Hi ${name},`,
    '',
    `You got an invitation to join ${projectName} on TeamFlow.`,
    'Open TeamFlow and sign in to start collaborating with your team.',
    '',
    'TeamFlow'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2>You got an invitation to TeamFlow</h2>
      <p>Hi ${name},</p>
      <p>You got an invitation to join <strong>${projectName}</strong> on TeamFlow.</p>
      <p>Open TeamFlow and sign in to start collaborating with your team.</p>
    </div>
  `;

  return {
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'TeamFlow <no-reply@teamflow.local>',
    to: email,
    subject,
    text,
    html
  };
};

const sendInvitationEmail = async (payload) => {
  const message = buildInvitationEmail(payload);

  if (!hasSmtpConfig()) {
    console.info('[email] SMTP not configured; invitation email preview generated', {
      to: message.to,
      subject: message.subject
    });

    return {
      delivered: false,
      mode: 'preview',
      message
    };
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail(message);

  return {
    delivered: true,
    mode: 'smtp',
    messageId: info.messageId
  };
};

module.exports = {
  sendInvitationEmail
};
