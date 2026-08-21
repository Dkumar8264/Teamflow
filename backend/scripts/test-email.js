const dotenv = require('dotenv');
const { sendInvitationEmail, verifyEmailTransport } = require('../src/services/emailService');

dotenv.config();

const recipient = process.argv[2];

const run = async () => {
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    console.error('Usage: npm run test:email -- teammate@example.com');
    process.exit(1);
  }

  const verification = await verifyEmailTransport();

  if (!verification.ok) {
    console.error(verification.message);
    process.exit(1);
  }

  const result = await sendInvitationEmail({
    email: recipient,
    name: 'TeamFlow Teammate',
    projectName: 'TeamFlow SMTP Test'
  });

  console.info('Email test result:', {
    delivered: result.delivered,
    mode: result.mode,
    messageId: result.messageId
  });
};

run().catch((error) => {
  console.error('Email test failed:', error.message);
  process.exit(1);
});
