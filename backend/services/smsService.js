const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

let client = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
        client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    } catch (err) {
        console.warn('Twilio client could not be initialized:', err.message);
        client = null;
    }
} else {
    console.info('Twilio not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN missing)');
}

const sendSms = async (to, message) => {
    if (!client || !TWILIO_PHONE_NUMBER) {
        console.warn('sendSms called but Twilio is not configured. Skipping.');
        return Promise.resolve({ mocked: true });
    }

    return client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: to,
    });
};

module.exports = { sendSms };