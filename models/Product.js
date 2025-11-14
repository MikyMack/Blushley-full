// models/Product.js
const mongoose = require('mongoose');

const SizeVariantSchema = new mongoose.Schema({
  size: String,
  sku: String,
  resellerPrice: { type: Number, default: 0 },
  adminPrice: { type: Number },
  stock: { type: Number, default: 0 },
  warehouseStock: [{
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller.warehouses' },
    qty: { type: Number, default: 0 }
  }],
  images: [String]
}, { _id: true });

const ColorVariantSchema = new mongoose.Schema({
  colorName: String,
  colorCode: String,
  sku: String,
  images: [String],
  resellerPrice: { type: Number, default: 0 },
  adminPrice: { type: Number },
  stock: { type: Number, default: 0 },
  sizeVariants: [SizeVariantSchema] 
}, { _id: true });

const ProductSchema = new mongoose.Schema({
  resellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller', required: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, index: true },

  brand: String,
  shortDescription: String,
  description: String,
  highlights: [String],
  images: [String], 


  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
  childCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildCategory' },

  variantType: { type: String, enum: ['none','color','size','color_size'], default: 'none' },

  colorVariants: [ColorVariantSchema],
  sizeVariants: [SizeVariantSchema],

  baseResellerPrice: { type: Number, default: 0 },
  adminPrice: { type: Number },  
  adminCommissionPercent: { type: Number, default: 0 },
  adminPriceHistory: [{
    previousPrice: Number,
    newPrice: Number,
    changedAt: Date,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  sku: String,
  totalStock: { type: Number, default: 0 },

  warranty: String,
  returnPolicy: String,
  specifications: [{ key: String, value: String }],
  dimensions: { height: Number, width: Number, length: Number, weight: Number },

  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],

  status: { type: String, enum: ['pending','approved','rejected','disabled'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,

  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 }

}, { timestamps: true });

ProductSchema.index({ resellerId: 1, status: 1 });
ProductSchema.index({ slug: 1 });

module.exports = mongoose.model('Product', ProductSchema);
