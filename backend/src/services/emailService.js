const nodemailer = require('nodemailer');

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    family: Number(process.env.SMTP_FAMILY || 4),
    connectionTimeout: Number(process.env.SMTP_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_TIMEOUT_MS || 10000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

const getClientUrl = () => {
  const [clientUrl] = String(process.env.CLIENT_URL || 'http://127.0.0.1:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return clientUrl || 'http://127.0.0.1:5173';
};

const buildInvitationEmail = ({ email, name, projectName }) => {
  const subject = `You got an invitation to join ${projectName} on TeamFlow`;
  const safeName = escapeHtml(name);
  const safeProjectName = escapeHtml(projectName);
  const appUrl = getClientUrl();
  const safeAppUrl = escapeHtml(appUrl);
  const text = [
    `Hi ${name},`,
    '',
    `You got an invitation to join ${projectName} on TeamFlow.`,
    `Open TeamFlow here: ${appUrl}`,
    'Sign in to start collaborating with your team.',
    '',
    'TeamFlow'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2>You got an invitation to TeamFlow</h2>
      <p>Hi ${safeName},</p>
      <p>You got an invitation to join <strong>${safeProjectName}</strong> on TeamFlow.</p>
      <p>Open TeamFlow and sign in to start collaborating with your team.</p>
      <p>
        <a href="${safeAppUrl}" style="display: inline-block; background: #d4ff00; border: 2px solid #111827; border-radius: 999px; color: #111827; font-weight: 700; padding: 10px 16px; text-decoration: none;">
          Open TeamFlow
        </a>
      </p>
      <p style="font-size: 13px; color: #4b5563;">${safeAppUrl}</p>
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

const verifyEmailTransport = async () => {
  if (!hasSmtpConfig()) {
    return {
      ok: false,
      mode: 'preview',
      message: 'SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS are required for real email delivery'
    };
  }

  const transporter = createTransporter();
  await transporter.verify();

  return {
    ok: true,
    mode: 'smtp',
    message: 'SMTP connection verified'
  };
};

module.exports = {
  buildInvitationEmail,
  hasSmtpConfig,
  verifyEmailTransport,
  sendInvitationEmail
};
