
const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema({
  name: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  phone: String,
  lat: Number,
  lng: Number
}, { _id: true });

const ResellerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  

  companyName: { type: String, required: true },
  gstNo: String,

  documents: [String],           
  status: { 
    type: String, 
    enum: ['pending','approved','rejected','disabled'], 
    default: 'pending' 
  },

  warehouses: [WarehouseSchema], 

  totalSales: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Reseller', ResellerSchema);
