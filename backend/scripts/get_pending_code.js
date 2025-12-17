require('dotenv').config();
const mongoose = require('mongoose');
const PendingUser = require('../models/PendingUser');

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
    console.error('usage: node get_pending_code.js user@example.com');
    process.exit(1);
  }
  const pending = await PendingUser.findOne({ email }).lean();
  if (!pending) {
    console.log('NOT_FOUND');
  } else {
    console.log(JSON.stringify(pending, null, 2));
  }
  process.exit(0);
}

run();
