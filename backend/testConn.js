require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

(async () => {
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  console.log('🔎 Testing MongoDB connection to:', uri.includes('mongodb+srv') ? '(SRV) ' + uri.split('@')[1] : uri);

  try {
    // Connect using default options (avoid deprecated flags)
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ MongoDB connection error:');
    console.error(err.message || err);

    // Provide helpful hints based on common errors
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    if (msg.includes('not authorized') || msg.includes('authentication')) {
      console.error('Hint: Authentication failed. Check username/password and user privileges.');
    }
    if (msg.includes('server selection') || msg.includes('could not connect') || msg.includes('timed out') || msg.includes('failed to get address info') || msg.includes('getaddrinfo')) {
      console.error('Hint: Network/DNS issue. Possible causes: IP not whitelisted in Atlas, DNS blocked, or cluster paused.');
    }
    if (msg.includes('ip') && msg.includes('whitelist')) {
      console.error('Hint: Your IP may not be whitelisted in MongoDB Atlas. Add your IP to the project Network Access list.');
    }
    if (msg.includes('mongodb+srv') && msg.includes('dns')) {
      console.error('Hint: SRV DNS lookup failed. Ensure your environment can resolve SRV records and you have network access.');
    }

    process.exit(1);
  }
})();
