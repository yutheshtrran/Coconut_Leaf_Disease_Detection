// server.js
const express = require('express');
// FORCE DNS to Google Public DNS to resolve SRV records on restricted networks
require('dns').setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;
const BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '500mb';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Connect to MongoDB with reconnection resilience
const MONGO_OPTS = {
  serverSelectionTimeoutMS: 30000,  // wait up to 30 s for a server to become available
  connectTimeoutMS:         15000,  // TLS handshake budget
  socketTimeoutMS:          60000,  // how long to wait on a slow query
  // Monitor less frequently so a single slow heartbeat doesn't wipe the pool
  heartbeatFrequencyMS:     30000,
  minHeartbeatFrequencyMS:  1000,   // but recover quickly after a failure
  // M0 free tier: keep pool small to avoid Atlas connection ceiling
  maxPoolSize:              5,
  minPoolSize:              1,      // keep 1 warm connection at all times
  maxIdleTimeMS:            45000,  // retire idle connections before Atlas does (~60 s)
  retryWrites:              true,
  retryReads:               true,
  readPreference:           'primaryPreferred',
};

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, MONGO_OPTS);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB initial connection failed:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected — Mongoose will auto-reconnect');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

connectDB();

// Routes (check these files exist!)
try {
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/flights', require('./routes/flightRoutes'));
  app.use('/api/reports', require('./routes/reportRoutes'));
  app.use('/api/alerts', require('./routes/alertRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/farms', require('./routes/farmRoutes'));
  // ML prediction route
  // app.use('/api/ml', require('./routes/mlRoutes'));

  app.use('/api/diseases', require('./routes/diseaseRoutes'));
  app.use('/api/drone-detections', require('./routes/droneDetectionRoutes'));
} catch (error) {
  console.error('⚠️ Route loading error:', error.message);
}

// Multer/file upload friendly errors
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Request entity too large. Increase REQUEST_BODY_LIMIT if the configured backend limit is not enough.',
    });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large. Max 5MB.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err && err.message && /Only JPEG|PNG|WEBP/.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

// Fallback error handler
app.use(errorHandler);

// Base route
app.get('/', (req, res) => {
  res.send('🌴 Coconut Leaf Detection Backend API is running...');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
