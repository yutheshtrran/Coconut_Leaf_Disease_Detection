
const fs = require('fs');
const path = require('path');
const { getVerificationEmailTemplate } = require('../utils/emailTemplates');

const code = '7X9k2P';
const html = getVerificationEmailTemplate(code, 'Registration');

const outputPath = path.join(__dirname, '..', 'test_email_output.html');
fs.writeFileSync(outputPath, html);

console.log(`Email HTML generated at: ${outputPath}`);
