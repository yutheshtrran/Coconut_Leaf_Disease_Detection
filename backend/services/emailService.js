
const nodemailer = require('nodemailer');
let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (e) {
    console.warn('SendGrid module not available:', e.message);
    sgMail = null;
  }
}

// Build a transporter if SMTP settings are provided, otherwise null
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
}

const transporter = createTransporter();

async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || `no-reply@${process.env.FRONTEND_HOST || 'localhost'}`;

  // Prefer SendGrid API when available
  if (sgMail) {
    try {
      const msg = { to, from, subject, text, html };
      const res = await sgMail.send(msg);
      return { provider: 'sendgrid', result: res };
    } catch (err) {
      console.error('SendGrid send error:', err?.response?.body || err.message || err);
      // fall through to SMTP or console fallback
    }
  }

  if (transporter) {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    return { provider: 'smtp', result: info };
  }

  // fallback: log to console for development/test
  console.log('Email fallback (no SMTP/SendGrid configured) - to:', to, 'subject:', subject, 'text:', text);
  return { fallback: true };
}

module.exports = { sendMail };
