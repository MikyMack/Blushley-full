const express = require('express');
const router = express.Router();
const salonCtrl = require('../controllers/salonController');
const { isAdmin,isLoggedIn,isRole } = require('../middlewares/auth');
const upload = require("../middlewares/upload");
const Salon = require('../models/Salon');
const bcrypt = require('bcrypt');
const SalonBooking = require("../models/SalonBooking");
const User = require('../models/User');

router.post(
  '/create',
  isAdmin,
  upload.fields([
    { name: "images", maxCount: 10 }
  ]),
  salonCtrl.createSalon
);

// List salons with filters and pagination
router.get(
  '/saloons',
  isAdmin,
  async (req, res) => {
    try {
      let {
        search = "",
        salonType,
        status,
        city,
        page = 1,
        limit = 10,
      } = req.query;

      page = parseInt(page) > 0 ? parseInt(page) : 1;
      limit = parseInt(limit) > 0 ? parseInt(limit) : 10;

      const filter = {};

      if (salonType && salonType !== "all") filter.salonType = salonType;
      if (status && status !== "all") filter.status = status;
      if (city && city !== "all") filter["address.city"] = { $regex: city, $options: "i" };

      // Search on name, ownerName, email, phone
      if (search && search.trim()) {
        const s = search.trim();
        filter.$or = [
          { name: { $regex: s, $options: "i" } },
          { ownerName: { $regex: s, $options: "i" } },
          { email: { $regex: s, $options: "i" } },
          { phone: { $regex: s, $options: "i" } },
        ];
      }

      const total = await Salon.countDocuments(filter);
      const salons = await Salon.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      return res.json({
        total,
        page,
        limit,
        salons
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to list salons" });
    }
  }
);

// Edit salon (GET form)
router.get('/edit/:id', isAdmin, salonCtrl.editSalonForm);

// Edit salon (POST with uploads)
router.post(
  '/edit/:id',
  isAdmin,
  upload.fields([{ name: "images", maxCount: 10 }]),
  salonCtrl.editSalon
);

// Delete salon
router.post(
  '/delete/:id',
  isAdmin,
  salonCtrl.deleteSalon
);

// Update status (active, inactive, disabled)
router.post(
  '/status/:id',
  isAdmin,
  salonCtrl.updateSalonStatus
);


router.get('/salon_dashboard', isLoggedIn, isRole('salon'), async (req, res) => {
    try {
        const salonId = req.session.user._id;  
        const today = new Date();

        const salon = await Salon.findById(salonId).lean();
        if (!salon) return res.status(404).send("Salon not found");

        /* ---- 1. Get All Bookings For This Salon ---- */
        const allBookings = await SalonBooking.find({
            "salon.salonId": salonId
        }).sort({ createdAt: -1 }).lean();

        /* ---- 2. Booking Categories ---- */
        const todaysBookings = allBookings.filter(b =>
            new Date(b.bookingDate).toDateString() === today.toDateString()
        );

        const upcomingBookings = allBookings.filter(b =>
            new Date(b.bookingDate) > today &&
            ['pending', 'confirmed'].includes(b.status)
        );

        const completedBookings = allBookings.filter(b =>
            b.status === "completed"
        );

        const cancelledBookings = allBookings.filter(b =>
            ['cancelled_by_user', 'cancelled_by_salon', 'rejected'].includes(b.status)
        );

        /* ---- 3. Earnings Calculation (Only Admin Approved) ---- */
        const earningsData = allBookings
            .filter(b => b.status === "completed" && b.paymentMarkedByAdmin === true)
            .reduce((acc, booking) => {
                acc.totalOrders += 1;
                acc.totalSalonEarnings += booking.paymentBreakdown?.salonEarning || 0;
                acc.totalCustomerPaid += booking.paymentBreakdown?.customerPaid || 0;
                acc.totalAdminCommission += booking.paymentBreakdown?.adminCommission || 0;
                return acc;
            }, {
                totalOrders: 0,
                totalSalonEarnings: 0,
                totalCustomerPaid: 0,
                totalAdminCommission: 0
            });

        /* ---- 4. Service Popularity Stats ---- */
        const serviceStats = {};
        allBookings.forEach(b => {
            b.services?.forEach(s => {
                if (!serviceStats[s.serviceName]) {
                    serviceStats[s.serviceName] = 0;
                }
                serviceStats[s.serviceName]++;
            });
        });

        const popularServices = Object.entries(serviceStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        /* ---- 5. Send to Frontend ---- */
        return res.render('saloon/salon_dashboard', {
            salon,
            allBookings,
            todaysBookings,
            upcomingBookings,
            completedBookings,
            cancelledBookings,

            earnings: earningsData,

            popularServices,
            bookingStats: {
                total: allBookings.length,
                today: todaysBookings.length,
                upcoming: upcomingBookings.length,
                completed: completedBookings.length,
                cancelled: cancelledBookings.length
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to load salon dashboard");
    }
});


router.post('/salonlogin', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        const salon = await Salon.findOne({ username: username });
        if (!salon) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const isMatch = await salon.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        // Set session role to 'salon' and store relevant info
        req.session.user = {
            _id: salon._id,
            name: salon.name,
            username: salon.username,
            email: salon.email,
            role: 'salon',
            status: salon.status
        };

        return res.json({
            success: true,
            salon: {
                _id: salon._id,
                name: salon.name,
                username: salon.username,
                email: salon.email,
                status: salon.status
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Login failed" });
    }
});

  // routes/salonRoutes.js
router.post(
    '/update-profile',
    isLoggedIn,
    isRole('salon'),
    upload.fields([{ name: "images", maxCount: 10 }]),
    salonCtrl.updateProfile
  );
  


module.exports = router;