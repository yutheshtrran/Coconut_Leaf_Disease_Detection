require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();
  if (process.env.NODE_ENV === 'production') {
    console.error('delete_user script is disabled in production');
    process.exit(1);
  }
  const identifier = process.argv[2] || 'smoketest';

  try {
    const res = await User.findOneAndDelete({ $or: [{ username: identifier }, { email: identifier }] });
    if (res) console.log('Deleted user:', res.username, res.email);
    else console.log('No user found for', identifier);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
