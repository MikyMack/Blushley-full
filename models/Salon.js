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

/* ---- Review ---- */
const ReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

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
  images: {
    type: [String],
    validate: [arr => arr.length <= 5, 'Maximum 5 images allowed']
  },
  serviceMode: {
    inSalon: { type: Boolean, default: true },
    homeService: { type: Boolean, default: false },
    homeServiceRadiusKm: { type: Number, default: 0 },
    homeServiceExtraCharge: { type: Number, default: 0 }
  },
  
  totalBookings: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
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

  // REVIEWS
  reviews: [ReviewSchema],

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

SalonSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('Salon', SalonSchema);
