
const mongoose = require('mongoose');

const SalonStaffSchema = new mongoose.Schema({
  name: String,
  phone: String,
  role: String,
  active: { type: Boolean, default: true }
}, { _id: true });

const SalonSchema = new mongoose.Schema({
  name: { type: String, required: true },

  username: { type: String, unique: true },
  passwordHash: String,      

  address: {
    line1: String,
    city: String,
    state: String,
    pincode: String,
    lat: Number,
    lng: Number
  },

  email: String,
  phone: String,
  images: [String],

  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  staff: [SalonStaffSchema],

  status: { 
    type: String, 
    enum: ['active','inactive','disabled'], 
    default: 'active' 
  },

  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

}, { timestamps: true });

module.exports = mongoose.model('Salon', SalonSchema);
