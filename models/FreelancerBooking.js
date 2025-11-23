const mongoose = require('mongoose');

const FreelancerBookingSchema = new mongoose.Schema({

  bookingToken: { type: String, unique: true, index: true },

  user: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    phone: String,
    email: String
  },

  freelancer: {
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Freelancer' },
    freelancerName: String,
    freelancerPhone: String
  },

  service: {
    serviceId: String,
    serviceName: String,
    durationMinutes: Number,
    price: Number
  },

  address: {
    fullAddress: String,
    city: String,
    state: String,
    pincode: String,
    lat: Number,
    lng: Number
  },

  bookingDate: { type: Date },
  bookingTime: String,

  notes: String,

  payment: {
    method: { type: String, enum: ['cod', 'online'], default: 'cod' },
    status: { type: String, enum: ['pending','paid','failed'], default: 'pending' }
  },

  status: {
    type: String,
    enum: [
      'waiting_admin_approval',
      'approved_by_admin',
      'rejected_by_admin',
      'accepted_by_freelancer',
      'cancelled_by_user',
      'completed'
    ],
    default: 'waiting_admin_approval'
  },

  adminAction: {
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminStaff' },
    actionAt: Date,
    message: String
  },

  freelancerResponse: {
    accepted: { type: Boolean, default: false },
    respondedAt: Date
  }

}, { timestamps: true });

module.exports = mongoose.model('FreelancerBooking', FreelancerBookingSchema);
