const express = require('express');
const router = express.Router();
const salonCtrl = require('../controllers/salonController');
const { isAdmin,isLoggedIn,isRole } = require('../middlewares/auth');

router.post('/create', isAdmin, salonCtrl.createSalon);

router.get('/salon_dashboard', isLoggedIn, isRole('salon'), (req, res) => {
    res.render('saloon/salon_dashboard');
});



module.exports = router;