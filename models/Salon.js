const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/* ---- Staff ---- */
const SalonStaffSchema = new mongoose.Schema({
  name: String,
  phone: String,
  role: {
    type: String,
    enum: ['manager', 'staff'],
    default: 'staff'
  },
  username: String,
  passwordHash: String,
  active: { type: Boolean, default: true }
}, { _id: true });

/* ---- Slot ---- */
const SlotSchema = new mongoose.Schema({
  startTime: String,
  endTime: String,
  isBooked: { type: Boolean, default: false }
});

/* ---- Daily Availability ---- */
const DailyAvailabilitySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6 },
  isOpen: { type: Boolean, default: true },

  openingTime: String,
  closingTime: String,

  slots: [SlotSchema],
  breakSlots: [{
    start: String,
    end: String
  }]
});

/* ---- Main Salon ---- */
const SalonSchema = new mongoose.Schema({

  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },

  // BASIC INFO
  name: { type: String, required: true },
  salonType: String,
  ownerName: String,
  email: String,
  phone: String,

  // ADDRESS
  address: {
    line1: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "India" }
  },

  // MAP LOCATION
  googleMapLink: String,

  description: String,
  images: [String],

  // BOOKING SYSTEM
  availability: [DailyAvailabilitySchema],
  slotDurationMinutes: { type: Number, default: 30 },
  closedDates: [Date],

  // SERVICES
  services: [{
    serviceName: String,
    price: Number,
    adminPrice: Number,
    durationMinutes: Number
  }],

  staff: [SalonStaffSchema],

  status: {
    type: String,
    enum: ['active', 'inactive', 'disabled'],
    default: 'active'
  },

  createdByAdmin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }

}, { timestamps: true });

/* PASSWORD COMPARISON METHOD */
SalonSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('Salon', SalonSchema);
