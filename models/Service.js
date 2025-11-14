const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  ownerType: { type: String, enum: ['salon','freelancer'] },
  ownerId: mongoose.Schema.Types.ObjectId,
  title: String,
  description: String,
  durationMinutes: Number,
  resellerPrice: Number,  
  adminPrice: Number,
  adminCommissionPercent: { type: Number, default: 0 },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Service', ServiceSchema);
