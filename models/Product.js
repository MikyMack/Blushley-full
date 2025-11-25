const mongoose = require("mongoose");

const VariantOptionSchema = new mongoose.Schema({
  value: String,        
  stock: { type: Number, default: 0 },
  sku: String,           
  price: Number,           
  adminBasePrice: Number,  
  adminSalePrice: Number,  
  images: [String]        
}, { _id: true });


const VariantSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  options: [VariantOptionSchema]
}, { _id: true });


const ProductSchema = new mongoose.Schema({

  // BASIC INFO
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  description: String,
  shortDescription: String,

  // CATEGORY
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
  childCategory: { type: mongoose.Schema.Types.ObjectId, ref: "ChildCategory" },


  beautyTips: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BeautyTip"
  }],

  // BRAND
  brand: String,

  productType: {
    type: String,
    enum: ["admin", "salon", "reseller"],
    default: "admin"
  },

  ownerRef: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "productType"
  },

  // UNIVERSAL PRICING
  basePrice: { type: Number, required: true },
  salePrice: Number,

  // ADMIN PRICE CONTROL ✅
  adminBasePrice: Number,
  adminSalePrice: Number,

  // TOTAL STOCK (Ignored when variants exist)
  totalStock: { type: Number, default: 0 },

  // VARIANTS: Color / Size / Volume etc ✅
  variants: [VariantSchema],

  // MAIN PRODUCT IMAGES
  images: [String],

  // PRODUCT PROPERTIES
  tags: [String],
  ingredients: [String],
  howToUse: String,
  benefits: [String],

  // SHIPPING
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },

  // RATINGS
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },

  // STATUS
  status: {
    type: String,
    enum: ["draft", "pending", "approved", "rejected", "disabled"],
    default: "pending"
  },

  // SEO
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },

  totalSold: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model("Product", ProductSchema);
