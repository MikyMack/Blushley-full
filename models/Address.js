const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  firstName: String,
  lastName: String,
  email: String,
  phone: String,

  addressLine1: String,
  addressLine2: String,

  country: String,
  state: String,
  city: String,
  zipCode: String,

  isDefault: { type: Boolean, default: false },

  addressType: { 
    type: String, 
    enum: ["home", "work", "other"], 
    default: "home" 
  }
}, { timestamps: true });

module.exports = mongoose.model("Address", AddressSchema);
