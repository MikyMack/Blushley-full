const express = require('express');
const router = express.Router();
const freelancerCtrl = require('../controllers/freelancerController');
const { isLoggedIn, isRole } = require('../middlewares/auth');

router.post('/beautician_register', freelancerCtrl.register);

router.get('/beautician_register', (req, res) => {
    res.render('freelancer/beautician_register');
});

router.get('/beautician_dashboard', isLoggedIn, isRole('freelancer'), (req, res) => {
    res.render('freelancer/beautician_dashboard');
});



module.exports = router;