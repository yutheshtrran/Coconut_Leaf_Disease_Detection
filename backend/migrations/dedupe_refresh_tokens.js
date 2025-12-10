// Simple migration to dedupe refreshTokens arrays for all users.
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();
  console.log('Starting dedupe migration...');
  const users = await User.find({});
  let changed = 0;
  for (const u of users) {
    if (Array.isArray(u.refreshTokens) && u.refreshTokens.length > 1) {
      const deduped = [...new Set(u.refreshTokens)];
      if (deduped.length !== u.refreshTokens.length) {
        u.refreshTokens = deduped;
        await u.save();
        changed++;
        console.log('Dedupe tokens for user', u._id, 'old:', u.refreshTokens.length, 'new:', deduped.length);
      }
    }
  }
  console.log('Dedupe migration complete. Users modified:', changed);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
