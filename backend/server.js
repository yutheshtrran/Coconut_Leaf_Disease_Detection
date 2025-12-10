// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json()); // replaces body-parser

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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
} catch (error) {
  console.error('⚠️ Route loading error:', error.message);
}

// Base route
app.get('/', (req, res) => {
  res.send('🌴 Coconut Leaf Detection Backend API is running...');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
