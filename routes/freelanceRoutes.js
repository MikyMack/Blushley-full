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

router.get('/beautician_dashboard', isLoggedIn, isRole('freelancer'), (req, res) => {
    res.render('freelancer/beautician_dashboard');
});

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


module.exports = router;