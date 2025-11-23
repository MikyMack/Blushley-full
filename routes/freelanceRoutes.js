const express = require('express');
const router = express.Router();
const freelancerCtrl = require('../controllers/freelancerController');
const { isLoggedIn, isRole,isAdmin } = require('../middlewares/auth');
const upload = require("../middlewares/upload");

router.post(
    "/beautician_register",
    upload.fields([
      { name: "profileImage", maxCount: 1 },
      { name: "portfolioImages", maxCount: 5 } 
    ]),
    freelancerCtrl.register
  );

router.get('/beautician_register', (req, res) => {
    res.render('freelancer/beautician_register');
});

router.get(
  '/beautician_dashboard',
  isLoggedIn,
  isRole('freelancer'),
  freelancerCtrl.getFreelancerDashboard
);

// Update freelancer
router.put(
  "/updateFreelancer/:id",
  isAdmin,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "portfolioImages", maxCount: 5 },
    { name: "documents", maxCount: 5 }
  ]),
  freelancerCtrl.updateFreelancer
);
// Get single freelancer
router.get("/freelancer/:id", isAdmin, freelancerCtrl.getFreelancerById);

// Update status (approve/reject/inactive)
router.patch("/:id/status", isAdmin, freelancerCtrl.updateStatus);

// Delete freelancer
router.delete("/deleteFreelancer/:id", isAdmin, freelancerCtrl.deleteFreelancer);

// Route: Admin creates a new freelancer (beautician) directly
router.post(
  "/createFreelancer",
  isAdmin,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "portfolioImages", maxCount: 5 },
    { name: "documents", maxCount: 5 }
  ]),
  freelancerCtrl.adminCreateFreelancer
);


router.post("/send-login-otp", freelancerCtrl.sendLoginOtp);
router.post("/verify-login-otp", freelancerCtrl.verifyLoginOtp);

router.post('/freelancerBook', isLoggedIn, freelancerCtrl.createBooking);
router.post('/adminApprove/:bookingId/action', isAdmin, freelancerCtrl.adminApproveBooking);
router.post('/FreelancerBooking/:bookingId/accept', isRole('freelancer'), freelancerCtrl.freelancerAcceptBooking);
router.get('/booking/:bookingToken', isLoggedIn, freelancerCtrl.getBookingDetails);

// Profile
router.put(
  '/freelancer/update-profile',
  isLoggedIn,
  isRole('freelancer'),
  freelancerCtrl.updateProfile
);

// Working hours
router.put(
  '/freelancer/update-availability',
  isLoggedIn,
  isRole('freelancer'),
  freelancerCtrl.updateAvailability
);

// Services
router.post(
  '/freelancer/add-service',
  isLoggedIn,
  isRole('freelancer'),
  freelancerCtrl.addService
);

router.delete(
  '/freelancer/remove-service/:serviceId',
  isLoggedIn,
  isRole('freelancer'),
  freelancerCtrl.removeService
);

// Locations
router.put(
  '/freelancer/update-locations',
  isLoggedIn,
  isRole('freelancer'),
  freelancerCtrl.updateLocations
);

module.exports = router;