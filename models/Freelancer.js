
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
  radius: Number
}, { _id: true });


const FreelancerServiceSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },

  freelancerBasePrice: { type: Number, required: true },

  adminPrice: { type: Number },

  adminCommissionPercent: { type: Number, default: 0 },

  finalPrice: Number,   

  durationMinutes: Number,

  images: [String], 

  status: { 
    type: String, 
    enum: ['pending','approved','rejected','inactive'], 
    default: 'pending' 
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminStaff' },
  approvedAt: Date
}, { timestamps: true, _id: true });

const FreelancerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  fullName: String,
  phone: String,
  email: String,

  bio: String,
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
  totalReviews: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('Freelancer', FreelancerSchema);
