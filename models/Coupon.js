const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },

  description: String,

  type: {
    type: String,
    enum: ["percentage", "flat"],
    required: true
  },

  discountValue: { type: Number, required: true },

  appliesTo: {
    type: String,
    enum: ["all", "categories", "products"],
    default: "all"
  },

  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

  minPurchase: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  usageLimit: { type: Number, default: 0 },     
  usedCount: { type: Number, default: 0 },

  perUserLimit: { type: Number, default: 1 },

  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Coupon", CouponSchema);
