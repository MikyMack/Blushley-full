// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const bookingCtrl = require('../controllers/bookingController');
const { isLoggedIn } = require('../middlewares/auth');

// Get available time slots
router.get('/available-slots', bookingCtrl.getAvailableSlots);

// Create booking (requires login)
router.post('/create', isLoggedIn, bookingCtrl.createBooking);

// Get user bookings
router.get('/my-bookings', isLoggedIn, bookingCtrl.getUserBookings);

// Cancel booking
router.post('/:bookingId/cancel', isLoggedIn, bookingCtrl.cancelBooking);

module.exports = router;