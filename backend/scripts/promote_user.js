require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = process.argv[2] || 'muzoufilmuhthaseem@gmail.com';
    const result = await User.updateOne({ email }, { $set: { role: 'admin' } });
    if (result.matchedCount === 0) {
      console.error(`User not found with email: ${email}`);
      process.exit(1);
    }
    console.log(`✅ Promoted ${email} to admin`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
