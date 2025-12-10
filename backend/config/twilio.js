const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Account SID from www.twilio.com/console
const authToken = process.env.TWILIO_AUTH_TOKEN;   // Your Auth Token from www.twilio.com/console

const client = twilio(accountSid, authToken);

const sendSms = (to, from, body) => {
    return client.messages.create({
        to: to,
        from: from,
        body: body
    });
};

module.exports = {
    sendSms
};