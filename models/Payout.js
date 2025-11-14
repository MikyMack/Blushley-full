
const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema({
  payeeType: { type: String, enum: ['reseller','freelancer','salon'] },
  payeeId: mongoose.Schema.Types.ObjectId,

  ordersIncluded: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  amountDue: Number,

  status: { type: String, enum: ['pending','paid'], default: 'pending' },
  paidAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Payout', PayoutSchema);
