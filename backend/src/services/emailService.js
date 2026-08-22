const nodemailer = require('nodemailer');

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const hasResendConfig = () => Boolean(process.env.RESEND_API_KEY);

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
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'TeamFlow <onboarding@resend.dev>',
    to: email,
    subject,
    text,
    html
  };
};

const sendWithResend = async (message) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Resend API failed with status ${response.status}`);
  }

  return {
    delivered: true,
    mode: 'resend',
    messageId: payload.id
  };
};

const sendInvitationEmail = async (payload) => {
  const message = buildInvitationEmail(payload);

  if (hasResendConfig()) {
    return sendWithResend(message);
  }

  if (!hasSmtpConfig()) {
    console.info('[email] Email provider not configured; invitation email preview generated', {
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
  if (hasResendConfig()) {
    return {
      ok: true,
      mode: 'resend',
      message: 'Resend API key configured'
    };
  }

  if (!hasSmtpConfig()) {
    return {
      ok: false,
      mode: 'preview',
      message: 'RESEND_API_KEY or SMTP settings are required for real email delivery'
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
  hasResendConfig,
  hasSmtpConfig,
  verifyEmailTransport,
  sendInvitationEmail
};
