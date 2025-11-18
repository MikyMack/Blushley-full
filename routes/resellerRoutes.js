const express = require('express');
const router = express.Router();
const resellerCtrl = require('../controllers/resellerController');
const { isLoggedIn, isRole } = require('../middlewares/auth');

router.get('/reseller_register', resellerCtrl.registerPage);
router.post('/register', resellerCtrl.register);


router.get('/reseller_dashboard',isLoggedIn, isRole('reseller'), (req, res) => {
    res.render('reseller/reseller_dashboard');
});



module.exports = router;