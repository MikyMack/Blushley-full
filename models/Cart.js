const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

  variantName: { type: String },    
  optionValue: { type: String },
  optionId: { type: String },      

  quantity: { type: Number, default: 1 },

  price: { type: Number, required: true },
}, { timestamps: true });

const CartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  items: [CartItemSchema],
}, { timestamps: true });

module.exports = mongoose.model("Cart", CartSchema);
