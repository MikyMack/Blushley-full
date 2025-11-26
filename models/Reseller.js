const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },

  address: String,
  city: String,
  state: String,
  pincode: String,
  phone: String,

  googleMapLink: {
    type: String
  },

  isDefault: { type: Boolean, default: false }

}, { _id: true });

const ResellerSchema = new mongoose.Schema({

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true
  },

  companyName: { type: String, required: true, trim: true },
  gstNo: { type: String, trim: true },

  contactName: { type: String },
  phone: { type: String },
  email: { type: String },
  businessDescription:{type:String},
  documents: [
    {
      name: String,
      url: String,
      uploadedAt: { type: Date, default: Date.now }
    }
  ],

  warehouses: [WarehouseSchema],

  status: { 
    type: String, 
    enum: ['pending','approved','rejected','disabled'], 
    default: 'pending'
  },

  verifiedByAdmin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },

  verifiedAt: Date,

  rejectionReason: String,

  totalSales: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('Reseller', ResellerSchema);
