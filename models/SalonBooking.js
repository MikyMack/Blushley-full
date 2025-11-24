const mongoose = require("mongoose");

const BookingServiceSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId },
  serviceName: String,

  basePrice: Number,  
  adminPrice: Number,  
  durationMinutes: Number
}, { _id: true });

const SalonBookingSchema = new mongoose.Schema({

  bookingToken: {
    type: String,
    unique: true,
    required: true
  },

  // USER DETAILS
  user: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    phone: String,
    email: String
  },

  // SALON DETAILS
  salon: {
    salonId: { type: mongoose.Schema.Types.ObjectId, ref: "Salon", required: true },
    salonName: String,
    salonPhone: String
  },

  // MULTIPLE SERVICES
  services: [BookingServiceSchema],

  // SERVICE TYPE
  bookingType: {
    type: String,
    enum: ["salon", "home"],
    default: "salon"
  },

  // SALON SERVICE LOCATION
  salonLocation: {
    address: String,
    googleMapLink: String
  },

  // HOME SERVICE LOCATION
  homeServiceLocation: {
    fullAddress: String,
    city: String,
    state: String,
    pincode: String,
    googleMapLink: String     // ✅ used ONLY if bookingType = home
  },

  bookingDate: Date,
  bookingTime: String,

  paymentBreakdown: {
    totalServiceAmount: Number,  
    customerPaid: Number,
    salonEarning: Number
  },

  payment: {
    method: { type: String, enum: ["online", "cod", "upi"], default: "online" },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" }
  },

  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "completed",
      "cancelled_by_user",
      "cancelled_by_salon",
      "rejected"
    ],
    default: "pending"
  },

  completedAt: Date,
  paymentMarkedByAdmin: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model("SalonBooking", SalonBookingSchema);
