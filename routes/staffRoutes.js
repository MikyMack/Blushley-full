const router = require('express').Router();
const staffCtrl = require('../controllers/staffController');
const { isAdmin } = require('../middlewares/auth');

// create staff
router.post('/create', isAdmin, staffCtrl.createStaff);

module.exports = router;
