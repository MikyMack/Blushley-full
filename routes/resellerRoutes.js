const express = require('express');
const router = express.Router();
const resellerCtrl = require('../controllers/resellerController');
const { isLoggedIn, isRole,isAdmin } = require('../middlewares/auth');
const upload = require("../middlewares/upload");
const Reseller = require('../models/Reseller');

router.get('/reseller_register', resellerCtrl.registerPage);
router.post(
  '/register', 
  upload.fields([
    { name: "documents", maxCount: 10 }
  ]), 
  resellerCtrl.registerReseller
);

router.get(
  '/reseller_dashboard',
  isLoggedIn,
  isRole('reseller'),
  async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;

    const filter = { };
    if (req.session.user && req.session.user.resellerId) {
      filter._id = req.session.user.resellerId;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    try {
    
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [resellers, totalResellers] = await Promise.all([
        Reseller.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Reseller.countDocuments(filter)
      ]);

      res.render('reseller/reseller_dashboard', {
        resellers,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResellers / parseInt(limit)),
        totalResellers,
        filters: { status, search }
      });
    } catch (err) {
      console.error('Error loading reseller dashboard:', err);
      res.status(500).render('error', { message: 'Failed to load reseller dashboard' });
    }
  }
);

router.post("/send-login-otp", resellerCtrl.sendLoginOtp);
router.post("/verify-login-otp", resellerCtrl.verifyLoginOtp);

router.patch('/approve/:resellerId', isAdmin, resellerCtrl.approveReseller);


module.exports = router;