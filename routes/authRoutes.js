// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const rateLimit = require('express-rate-limit');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const ChildCategory = require('../models/ChildCategory');

// gentle limiter for send-otp
const sendOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests, try again later' }
});

// OTP routes
router.post('/auth/send-otp', sendOtpLimiter, auth.sendOtp);
router.post('/verify-otp', auth.verifyOtp);
router.get('/logout', auth.logout);

// Admin login pages (GET should render view in your front-end)
router.get('/admin-login', async (req, res) => {
  const [categories, subcategories, childcategories] = await Promise.all([
    Category.find({ isActive: true }).lean(),
    SubCategory.find({ isActive: true }).lean(),
    ChildCategory.find({ isActive: true }).lean()
  ]);
  res.render('admin/admin_login', {
    categories,
    subcategories,
    childcategories
  });
});
router.post('/admin-login', auth.adminLogin);

// Salon login
router.get('/salon-login', (req, res) => res.render('salon/login'));
router.post('/salon-login', auth.salonLogin);
// user login 
router.post('/user/send-otp', auth.sendUserLoginOtp);
router.post('/user/verify-otp', auth.verifyUserLoginOtp);


module.exports = router;
