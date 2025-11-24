
const express = require('express');
const router = express.Router();
const Freelancer = require('../models/Freelancer');
const { isAdmin } = require("../middlewares/auth");
const FreelancerBooking = require('../models/FreelancerBooking');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const ChildCategory = require('../models/ChildCategory');

router.get('/adminLogin', (req, res) => {
    res.render('admin/admin_login');
});

router.get('/dashboard',isAdmin, (req, res) => {
    res.render('admin/admin_dashboard');
});

router.get('/banner', (req, res) => {
    res.render('admin/admin_banner');
});

router.get('/blogs', (req, res) => {
    res.render('admin/admin_blogs');
});



router.get('/bookings',isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }

        const [bookings, total] = await Promise.all([
            FreelancerBooking.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FreelancerBooking.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/admin_bookings', {
            bookings,
            page,
            totalPages,
            total,
            limit,
            filterStatus: req.query.status || 'all',
            error: null
        });
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).render('admin/admin_bookings', {
            bookings: [],
            page: 1,
            totalPages: 1,
            total: 0,
            limit: 10,
            filterStatus: req.query.status || 'all',
            error: 'Failed to load bookings'
        });
    }
});



router.get('/categories',isAdmin, async (req, res) => {
    try {
        const categories = await Category.find({}).lean();
        const subcategories = await SubCategory.find({}).lean();
        const childcategories = await ChildCategory.find({}).lean();

        res.render('admin/admin_categories', {
            categories,
            subcategories,
            childcategories
        });
    } catch (err) {
        console.error('Error loading categories:', err);
        res.status(500).render('admin/admin_categories', {
            categories: [],
            subcategories: [],
            childcategories: [],
            error: 'Failed to load category data'
        });
    }
});



router.get('/freelance',isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (req.query.q) {
            const q = req.query.q.trim();
            query.$or = [
                { fullName: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ];
        }
        if (req.query.status) {
            query.status = req.query.status;
        }

        const [freelancers, total] = await Promise.all([
            Freelancer.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Freelancer.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/admin_freelancer', {
            freelancers,
            page,
            totalPages,
            total,
            query: req.query
        });
    } catch (err) {
        console.error('Error fetching freelancers:', err);
        res.status(500).render('admin/admin_freelancer', { freelancers: [], error: 'Failed to load freelancers' });
    }
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