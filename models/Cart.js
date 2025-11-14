
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  
  variantType: { type: String, enum: ['none','size','color','color_size'], default: 'none' },

  sizeId: { type: String },


  colorId: { type: String },

  colorVariantId: { type: String },
  sizeVariantId: { type: String },

  qty: { type: Number, default: 1 },

  priceAtAddTime: Number,
  adminCommissionPercent: Number,

  warehouseId: { type: mongoose.Schema.Types.ObjectId }
});

const CartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [CartItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Cart', CartSchema);
