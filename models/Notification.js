
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },


  type: {
    type: String,
    enum: [
      'order',        
      'booking',       
      'wallet_credit', 
      'wallet_debit',  
      'payout',       
      'general'         
    ],
    default: 'general'
  },


  title: { type: String, required: true },
  message: { type: String, required: true },

  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },

  points: { type: Number, default: 0 },

  isRead: { type: Boolean, default: false },

  priority: { type: String, enum: ['low','normal','high'], default: 'normal' },

  isGlobal: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
