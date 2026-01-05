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

const ProductReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String },
  rating: { type: Number, min: 1, max: 5 },
  content: { type: String }
}, { timestamps: true, _id: true });


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

  brand: String,

  productType: {
    type: String,
    enum: ["admin", "salon", "reseller"],
    default: "admin"
  },

  ownerRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  basePrice: { type: Number, required: true },
  salePrice: Number,

  adminBasePrice: Number,
  adminSalePrice: Number,

  totalStock: { type: Number, default: 0 },

  variants: [VariantSchema],

  images: [String],

  tags: [String],
  ingredients: [String],
  howToUse: String,
  benefits: [String],

  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },


  reviews: [ProductReviewSchema], 

 
  rating: { 
    type: Number, 
    default: 0 
  },
  totalReviews: { 
    type: Number, 
    default: 0 
  },

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

// Add a method to recalculate rating and totalReviews from reviews array
ProductSchema.methods.recalculateRatings = function() {
  if (!this.reviews || this.reviews.length === 0) {
    this.rating = 0;
    this.totalReviews = 0;
  } else {
    this.totalReviews = this.reviews.length;
    this.rating = this.reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / this.totalReviews;
  }
};

module.exports = mongoose.model("Product", ProductSchema);
