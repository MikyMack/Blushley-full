const express = require('express');
const router = express.Router();

const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const ChildCategory = require('../models/ChildCategory');
const Product = require('../models/Product');

router.get('/', async (req, res) => {
    try {
        const [categories, subcategories, childcategories] = await Promise.all([
            Category.find({ isActive: true }).lean(),
            SubCategory.find({ isActive: true }).lean(),
            ChildCategory.find({ isActive: true }).lean()
        ]);
        let products = [];
        products = await Product.aggregate([
            { $match: { status: "approved" } },
            { $sample: { size: 4 } }
        ]);

        res.render('user/home', { categories, subcategories, childcategories, products });
    } catch (err) {
        console.error("Error loading categories or products for home page:", err);
        res.render('user/home', { categories: [], subcategories: [], childcategories: [], products: [], error: "Could not load categories or products" });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('user/about');
});
// Shop page
router.get('/shop', (req, res) => {
    res.render('user/shop');
});
// product details page
router.get('/productDetails/:title', (req, res) => {
    res.render('user/productDetails');
});
// userlogin 
router.get('/userLogin', (req, res) => {
    res.render('user/userLogin');
});
// saloon at home 
router.get('/saloon-at-home', (req, res) => {
    res.render('user/saloonAtHome');
});

// book a saloon 
router.get('/book-a-saloon', (req, res) => {
    res.render('user/saloon-service');
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('user/contact');
});
// blogs 
router.get('/beauty-tips', (req, res) => {
    res.render('user/beauty-tips');
});
// blogs details 
router.get('/beauty-tips/:title', (req, res) => {
    res.render('user/beautyDetails');
});
// account 
router.get('/user-account', (req, res) => {
    res.render('user/userAccount');
});
// orders 
router.get('/user-orders', (req, res) => {
    res.render('user/userOrders');
});
// addresses 
router.get('/user-addresses', (req, res) => {
    res.render('user/userAddresses');
});
// wishlist 
router.get('/wishlist', (req, res) => {
    res.render('user/wishlist');
});
// cart 
router.get('/cart', (req, res) => {
    res.render('user/cart');
});
// checkout 
router.get('/checkout', (req, res) => {
    res.render('user/checkout');
});
// user bookings
router.get('/userBookings', (req, res) => {
    res.render('user/userBookings');
});
// faq
router.get('/faq', (req, res) => {
    res.render('user/faq');
}); 
// payment confirmation success
router.get('/payment-confirmation', (req, res) => {
    res.render('user/payment-confirmation');
});
// payment confirmation failed
router.get('/payment-failed', (req, res) => {
    res.render('user/payment-failure');
});
// terms and conditions
router.get('/terms_and_conditions', (req, res) => {
    res.render('user/terms_and_conditions');
});
// privacy policy
router.get('/privacy_policy', (req, res) => {
    res.render('user/privacy_policy');
});





module.exports = router;
