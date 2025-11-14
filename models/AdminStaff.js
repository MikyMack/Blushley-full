
const mongoose = require('mongoose');

const AdminStaffSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,  

  role: { 
    type: String, 
    enum: ['superadmin','admin','staff'], 
    default: 'staff' 
  },

  permissions: {
    manageProducts: { type: Boolean, default: false },
    manageResellers: { type: Boolean, default: false },
    manageFreelancers: { type: Boolean, default: false },
    manageSaloons: { type: Boolean, default: false },
    manageOrders: { type: Boolean, default: false },
    managePayouts: { type: Boolean, default: false },
    manageBanners: { type: Boolean, default: false },
    manageCategories: { type: Boolean, default: false },
    manageUsers: { type: Boolean, default: false },
    fullAccess: { type: Boolean, default: false } 
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminStaff' },

  isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('AdminStaff', AdminStaffSchema);
