const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema({
  title: { type: String },
  subtitle: { type: String },
  description: { type: String },
  link: { type: String },
  image: { type: String },       
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Banner", BannerSchema);
