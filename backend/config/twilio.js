const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

let client = null;
const isConfigured = typeof accountSid === 'string' && accountSid.startsWith('AC') && typeof authToken === 'string' && authToken.length > 0;
if (isConfigured) {
    try {
        client = twilio(accountSid, authToken);
    } catch (err) {
        console.warn('Twilio initialization failed:', err?.message);
    }
} else {
    console.warn('Twilio not configured: set TWILIO_ACCOUNT_SID (starts with AC) and TWILIO_AUTH_TOKEN');
}

const sendSms = (to, from, body) => {
    if (!client) {
        return Promise.reject(new Error('Twilio client not configured'));
    }
    return client.messages.create({ to, from, body });
};

module.exports = { sendSms };