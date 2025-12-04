const mongoose = require('mongoose');

const AvailabilitySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6 },
  slots: [{
    start: String,
    end: String
  }]
}, { _id: true });

const ServiceLocationSchema = new mongoose.Schema({
  city: String,
  state: String,
  pincode: String,
  radius: { type: Number, default: 5 }
}, { _id: true });

const FreelancerServiceSchema = new mongoose.Schema({
  serviceId: { type: String, required: true },

  freelancerBasePrice: Number,
  adminPrice: Number,
  adminCommissionPercent: { type: Number, default: 0 },
  finalPrice: Number,

  durationMinutes: Number,


  forWhom: {
    type: String,
    enum: ['Women', 'Men', 'Unisex'],
    default: 'Unisex'
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'inactive'],
    default: 'pending'
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminStaff' },
  approvedAt: Date
}, { timestamps: true });

const FreelancerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  fullName: String,
  phone: String,
  email: String,
  professionalTitle: { type: String },

  experience: { type: Number, default: 0 },  

  bio: String,

  skills: [String],

  proof: {
    type: { type: String },
    number: String
  },

  profileImage: String,
  portfolioImages: [String],
  documents: [String],

  freelancerServices: [FreelancerServiceSchema],  

  locations: [ServiceLocationSchema],
  availability: [AvailabilitySchema],

  status: {
    type: String,
    enum: ['pending','approved','rejected','inactive'],
    default: 'pending'
  },

  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 }

}, { timestamps: true });

module.exports = mongoose.model('Freelancer', FreelancerSchema);
