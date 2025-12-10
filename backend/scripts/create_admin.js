require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();
  if (process.env.NODE_ENV === 'production') {
    console.error('create_admin script is disabled in production');
    process.exit(1);
  }
  const username = process.argv[2] || 'admin';
  const email = process.argv[3] || 'admin@example.com';
  const password = process.argv[4] || 'ChangeMe123!';

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      user.role = 'admin';
      if (password) user.password = password; // will be hashed on save
      await user.save();
      console.log('Updated existing user to admin:', user.username, user.email);
    } else {
      user = new User({ username, email, password, role: 'admin' });
      await user.save();
      console.log('Created admin user:', user.username, user.email);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
