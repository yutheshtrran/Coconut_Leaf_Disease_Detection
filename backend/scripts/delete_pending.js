require('dotenv').config();
const mongoose = require('mongoose');
const PendingUser = require('../models/PendingUser');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

async function run() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => { console.error('Mongo connect error', err); process.exit(1); });
  const email = process.argv[2];
  if (!email) { console.error('usage: node delete_pending.js user@example.com'); process.exit(1); }
  const res = await PendingUser.findOneAndDelete({ email });
  if (!res) console.log('No pending found for', email);
  else console.log('Deleted pending for', email);
  process.exit(0);
}

run();
