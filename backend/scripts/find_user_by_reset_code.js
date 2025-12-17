require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

async function run() {
  await mongoose.connect(uri).catch(e => { console.error(e); process.exit(1); });
  const code = process.argv[2];
  if (!code) { console.error('usage: node find_user_by_reset_code.js CODE'); process.exit(1); }
  const user = await User.findOne({ resetPasswordCode: code }).lean();
  console.log(user ? JSON.stringify(user, null, 2) : 'NOT_FOUND');
  process.exit(0);
}
run();
