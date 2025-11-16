
const express = require('express');
const router = express.Router();

router.get('/adminLogin', (req, res) => {
    res.render('admin/admin_login');
});

router.get('/dashboard', (req, res) => {
    res.render('admin/admin_dashboard');
});

router.get('/banner', (req, res) => {
    res.render('admin/admin_banner');
});

router.get('/blogs', (req, res) => {
    res.render('admin/admin_blogs');
});

router.get('/bookings', (req, res) => {
    res.render('admin/admin_bookings');
});

router.get('/categories', (req, res) => {
    res.render('admin/admin_categories');
});

router.get('/freelance', (req, res) => {
    res.render('admin/admin_freelancer');
});


module.exports = router;