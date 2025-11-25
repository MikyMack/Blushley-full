const mongoose = require("mongoose");

const BeautyTipSchema = new mongoose.Schema({

  title: { type: String, required: true },
  slug: { type: String, unique: true },

  shortDescription: String,
  fullDescription: String,

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },

  image: String,

  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }],

  tags: [String],

  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft"
  }

}, { timestamps: true });

module.exports = mongoose.model("BeautyTip", BeautyTipSchema);
