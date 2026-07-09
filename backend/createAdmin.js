/**
 * One-time script to create an admin user in the local MongoDB.
 * Run once: node createAdmin.js
 * Delete this file afterwards.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');

const ADMIN = {
  username: 'admin',
  email:    'admin@cocoguard.com',
  password: 'Admin@1234',   // change this after first login
  role:     'admin',
  emailVerified: true,
  status:   'active',
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    process.exit(0);
  }

  const user = new User(ADMIN);
  await user.save();            // pre-save hook hashes the password automatically
  console.log('✅ Admin created:');
  console.log('   Email   :', ADMIN.email);
  console.log('   Password:', ADMIN.password);
  process.exit(0);
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
