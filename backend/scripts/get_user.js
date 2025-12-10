require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
    console.error('Mongo connect error', err);
    process.exit(1);
  });
  const email = process.argv[2];
  if (!email) {
    console.error('usage: node get_user.js user@example.com');
    process.exit(1);
  }
  const user = await User.findOne({ email }).lean();
  if (!user) {
    console.log('NOT_FOUND');
  } else {
    console.log(JSON.stringify(user, null, 2));
  }
  process.exit(0);
}

run();
