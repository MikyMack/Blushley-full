
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  
  variantType: String,
  sizeId: String,
  colorId: String,
  colorVariantId: String,
  sizeVariantId: String,

  qty: Number,
  priceShown: Number,
  
  resellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller' },

  warehouseId: { type: mongoose.Schema.Types.ObjectId },

  commissionPercent: Number,
  commissionAmount: Number,
  resellerEarning: Number,
});

const OrderSchema = new mongoose.Schema({
  orderNumber: String,  // BLUSH-000001
  
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  address: {
    name: String,
    phone: String,
    line1: String,
    city: String,
    state: String,
    pincode: String,
  },

  items: [OrderItemSchema],

  subtotal: Number,
  shippingCharge: Number,
  total: Number,

  paymentMethod: { type: String, enum: ['payu','cod'] },
  paymentStatus: { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },

  porter: {
    jobId: String,
    status: String,
    rawResponse: Object
  },

  orderStatus: { 
    type: String, 
    enum: ['pending','confirmed','shipped','delivered','cancelled'], 
    default: 'pending' 
  },

}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
