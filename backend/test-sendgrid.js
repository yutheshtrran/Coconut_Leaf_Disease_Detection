require('dotenv').config();
const { sendMail } = require('./services/emailService');

(async () => {
  try {
    const to = process.env.TEST_SEND_TO || 'smoketest@example.com';
    const subject = 'SendGrid service test - Coconut App';
    const text = 'This is a test email sent via SendGrid (or SMTP) from the Coconut Leaf project.';
    const res = await sendMail({ to, subject, text });
    console.log('sendMail result:', res);
  } catch (err) {
    console.error('Test send error:', err);
    process.exit(1);
  }
})();
