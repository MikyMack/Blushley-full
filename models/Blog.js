const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema({

  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  shortDescription: { type: String },
  fullDescription: { type: String, required: true },

  image: { type: String },

  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    canonicalUrl: String
  },


  author: {
    name: { type: String, required: true }
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },

  tags: [String],
  highlights: [String],

  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft"
  },

  publishedAt: Date,

}, { timestamps: true });

module.exports = mongoose.model("Blog", BlogSchema);
