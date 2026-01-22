const mongoose = require('mongoose');

const WishlistItemSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  // Store variant details if user selected specific variant before adding to wishlist
  variantName: { type: String },
  optionValue: { type: String },
  optionId: { type: String }
});

const WishlistSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
  items: [WishlistItemSchema]
}, { timestamps: true });

module.exports = mongoose.model("Wishlist", WishlistSchema);