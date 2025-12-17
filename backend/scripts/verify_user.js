require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();
  if (process.env.NODE_ENV === 'production') {
    console.error('verify_user script is disabled in production');
    process.exit(1);
  }
  const identifier = process.argv[2] || 'smoketest';
  try {
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user) {
      console.log('No user found for', identifier);
      process.exit(1);
    }
    user.emailVerified = true;
    user.verifyToken = undefined;
    user.verifyExpires = undefined;
    await user.save();
    console.log('User verified:', user.username, user.email);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
