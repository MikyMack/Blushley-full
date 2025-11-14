
const mongoose = require('mongoose');

const SubCategorySchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  image: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SubCategory', SubCategorySchema);
