// server.js
const express = require('express');
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

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json()); // replaces body-parser
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1); // Exit process with failure
  }
};
connectDB();

// Routes (check these files exist!)
try {
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/flights', require('./routes/flightRoutes'));
  app.use('/api/reports', require('./routes/reportRoutes'));
  app.use('/api/alerts', require('./routes/alertRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  // ML prediction route
  // app.use('/api/ml', require('./routes/mlRoutes'));

  app.use('/api/diseases', require('./routes/diseaseRoutes'));
} catch (error) {
  console.error('⚠️ Route loading error:', error.message);
}

// Multer/file upload friendly errors
app.use((err, req, res, next) => {
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
