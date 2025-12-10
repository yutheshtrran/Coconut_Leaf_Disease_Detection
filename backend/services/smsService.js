const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const sendSms = (to, message) => {
    return client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: to
    });
};

module.exports = {
    sendSms
};