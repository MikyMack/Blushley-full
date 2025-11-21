// config/db.js
const mongoose = require('mongoose');

async function connectDB(mongoUri) {
  if (!mongoUri) throw new Error('MONGO_URI not provided');
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = { connectDB };
