const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  phone: { type: String, index: true }, 
  email: { type: String, index: true },  

  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },

  purpose: { 
    type: String, 
    enum: [
      'login',              
      'reseller_verify',  
      'freelancer_verify' ,
      'freelancer_login'  
    ], 
    required: true 
  },

  expiresAt: { type: Date, required: true }
}, { timestamps: true });

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', OtpSchema);
