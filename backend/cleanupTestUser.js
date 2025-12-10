require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGO_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const username = process.argv[2] || process.env.CLEANUP_USERNAME || 'autotest1';
  try {
    const res = await User.findOneAndDelete({ username });
    if (res) {
      console.log(`✅ Deleted user with username='${username}' (id=${res._id})`);
    } else {
      console.log(`ℹ️ No user found with username='${username}'`);
    }
  } catch (err) {
    console.error('Error deleting user:', err.message || err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
