
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  name: String,
  email: String,
  role: { type: String, enum: ['user','reseller','freelancer','salon','staff','admin','superadmin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  wallet: {
    balance: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 }
  },
  isBlocked: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
