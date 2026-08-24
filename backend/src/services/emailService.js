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
  return deliver(buildInvitationEmail(payload));
};

/**
 * Shared delivery path: Resend API first (Render blocks outbound SMTP on free plans),
 * SMTP second, and a no-op "preview" mode when neither is configured.
 *
 * `sensitive: true` suppresses logging of the rendered body in preview mode, because
 * verification and password-reset messages embed single-use tokens that must not end
 * up in a log aggregator. In development the link is still printed so local flows are
 * testable without an email provider.
 */
const deliver = async (message, { sensitive = false } = {}) => {
  if (hasResendConfig()) {
    return sendWithResend(message);
  }

  if (!hasSmtpConfig()) {
    if (sensitive) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[email] No email provider configured; security email NOT sent', {
          to: message.to,
          subject: message.subject
        });
      } else {
        console.info('[email] Preview mode — open this link locally:', {
          to: message.to,
          link: message.previewLink
        });
      }

      return { delivered: false, mode: 'preview' };
    }

    console.info('[email] Email provider not configured; email preview generated', {
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

const buildActionEmail = ({ email, name, subject, heading, bodyLines, ctaLabel, link, footer }) => {
  const safeName = escapeHtml(name || 'there');
  const safeLink = escapeHtml(link);
  const text = [
    `Hi ${name || 'there'},`,
    '',
    ...bodyLines,
    '',
    link,
    '',
    footer,
    '',
    'TeamFlow'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2>${escapeHtml(heading)}</h2>
      <p>Hi ${safeName},</p>
      ${bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
      <p>
        <a href="${safeLink}" style="display: inline-block; background: #d4ff00; border: 2px solid #111827; border-radius: 999px; color: #111827; font-weight: 700; padding: 10px 16px; text-decoration: none;">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>
      <p style="font-size: 13px; color: #4b5563;">${safeLink}</p>
      <p style="font-size: 13px; color: #4b5563;">${escapeHtml(footer)}</p>
    </div>
  `;

  return {
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'TeamFlow <onboarding@resend.dev>',
    to: email,
    subject,
    text,
    html,
    previewLink: link
  };
};

const sendVerificationEmail = async ({ email, name, token }) => {
  const link = `${getClientUrl()}/verify-email?token=${encodeURIComponent(token)}`;

  return deliver(
    buildActionEmail({
      email,
      name,
      subject: 'Verify your TeamFlow email address',
      heading: 'Confirm your email',
      bodyLines: [
        'Confirm this email address to finish setting up your TeamFlow account.',
        'This link expires in 24 hours.'
      ],
      ctaLabel: 'Verify email',
      link,
      footer: 'If you did not create a TeamFlow account, you can ignore this email.'
    }),
    { sensitive: true }
  );
};

const sendPasswordResetEmail = async ({ email, name, token, expiresInMinutes }) => {
  const link = `${getClientUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  return deliver(
    buildActionEmail({
      email,
      name,
      subject: 'Reset your TeamFlow password',
      heading: 'Reset your password',
      bodyLines: [
        'Use the button below to choose a new password.',
        `This link can only be used once and expires in ${expiresInMinutes} minutes.`
      ],
      ctaLabel: 'Reset password',
      link,
      footer: 'If you did not request a password reset, ignore this email — your password has not changed.'
    }),
    { sensitive: true }
  );
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
  sendInvitationEmail,
  sendVerificationEmail,
  sendPasswordResetEmail
};
