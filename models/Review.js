
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 1, max: 5 },
  review: String,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false } 
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);
