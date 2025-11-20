
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

router.get('/saloon', (req, res) => {
    res.render('admin/admin_saloon');
});

router.get('/testimonials', (req, res) => {
    res.render('admin/admin_testimonials');
});

router.get('/users', (req, res) => {
    res.render('admin/admin_users');
});

router.get('/products', (req, res) => {
    res.render('admin/admin_products');
});

router.get('/orders', (req, res) => {
    res.render('admin/admin_orders');
});

router.get('/reseller_products', (req, res) => {
    res.render('admin/admin_reseller_product');
});


module.exports = router;