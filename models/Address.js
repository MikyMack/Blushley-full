
const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  phone: String,
  line1: String,
  city: String,
  state: String,
  pincode: String,
  isDefault: { type: Boolean, default: false },
  addressType: { type: String, enum: ['home', 'work', 'other'], default: 'home' }
}, { timestamps: true });

module.exports = mongoose.model('Address', AddressSchema);
