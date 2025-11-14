
const mongoose = require('mongoose');

const ChildCategorySchema = new mongoose.Schema({
  subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  image: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ChildCategory', ChildCategorySchema);
