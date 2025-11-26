
const express = require('express');
const router = express.Router();
const Freelancer = require('../models/Freelancer');
const { isAdmin } = require("../middlewares/auth");
const FreelancerBooking = require('../models/FreelancerBooking');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const ChildCategory = require('../models/ChildCategory');
const SalonBooking = require('../models/SalonBooking');
const Product = require('../models/Product');
const Reseller = require('../models/Reseller');


router.get('/adminLogin', (req, res) => {
    res.render('admin/admin_login');
});

router.get('/dashboard',isAdmin, (req, res) => {
    res.render('admin/admin_dashboard');
});

router.get('/banner', (req, res) => {
    res.render('admin/admin_banner');
});

router.get('/blogs', isAdmin, async (req, res) => {
    try {
        const categories = await Category.find({ status: { $ne: 'deleted' } }).lean();
        res.render('admin/admin_blogs', { categories });
    } catch (error) {
        console.error('Error fetching categories for blogs:', error);
        res.render('admin/admin_blogs', { categories: [], error: 'Failed to load categories' });
    }
});


router.get('/bookings', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) > 0 ? parseInt(req.query.page, 10) : 1;
        const limit = parseInt(req.query.limit, 10) > 0 ? parseInt(req.query.limit, 10) : 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }

        const bookingType = req.query.type || 'all';
        let freelancerBookings = [];
        let salonBookings = [];
        let freelancerTotal = 0;
        let salonTotal = 0;

        let bookings, total, totalPages;

        if (bookingType === 'freelance') {
            [freelancerBookings, freelancerTotal] = await Promise.all([
                FreelancerBooking.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                FreelancerBooking.countDocuments(filter)
            ]);
            bookings = freelancerBookings.map(b => ({ ...b, bookingSource: 'freelance' }));
            total = freelancerTotal;
            totalPages = Math.ceil(total / limit);
        } else if (bookingType === 'salon') {
            [salonBookings, salonTotal] = await Promise.all([
                SalonBooking.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                SalonBooking.countDocuments(filter)
            ]);
            bookings = salonBookings.map(b => ({ ...b, bookingSource: 'salon' }));
            total = salonTotal;
            totalPages = Math.ceil(total / limit);
        } else {
    
            const [allFreelancer, allSalon, countFreelancer, countSalon] = await Promise.all([
                FreelancerBooking.find(filter)
                    .sort({ createdAt: -1 })
                    .lean(),
                SalonBooking.find(filter)
                    .sort({ createdAt: -1 })
                    .lean(),
                FreelancerBooking.countDocuments(filter),
                SalonBooking.countDocuments(filter)
            ]);
        
            const freelancerWithType = allFreelancer.map(b => ({ ...b, bookingSource: 'freelance' }));
            const salonWithType = allSalon.map(b => ({ ...b, bookingSource: 'salon' }));
     
            const merged = [...freelancerWithType, ...salonWithType];
            merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
            bookings = merged.slice(skip, skip + limit);
            total = merged.length;
            totalPages = Math.ceil(total / limit);
        }

        res.render('admin/admin_bookings', {
            bookings,
            page,
            totalPages,
            total,
            limit,
            filterStatus: req.query.status || 'all',
            filterType: bookingType,
            bookingType, 
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
            filterType: req.query.type || 'all',
            bookingType: req.query.type || 'all',
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
router.get('/beautyTips', isAdmin, async (req, res) => {
    try {
        const categories = await Category.find({}).lean();
        res.render('admin/admin_beautytips', { categories });
    } catch (err) {
        console.error("Error fetching categories for beautyTips:", err);
        res.render('admin/admin_beautytips', { categories: [], error: 'Failed to load categories' });
    }
});


router.get('/products', isAdmin, async (req, res) => {
    try {
        let { page = 1, search = "", status, category, subCategory, childCategory, brand, productType } = req.query;
        let limit = req.query.limit ? parseInt(req.query.limit) : 20;
        page = parseInt(page);

        const query = {};

        if (search && search.trim() !== "") {
            const searchRegex = new RegExp(search.trim(), "i");
            query.$or = [
                { title: searchRegex },
                { slug: searchRegex },
                { description: searchRegex },
                { shortDescription: searchRegex }
            ];
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        if (category && category !== "all") {
            query.category = category;
        }
        if (subCategory && subCategory !== "all") {
            query.subCategory = subCategory;
        }
        if (childCategory && childCategory !== "all") {
            query.childCategory = childCategory;
        }

        if (brand && brand.trim() !== "") {
            query.brand = brand.trim();
        }

        if (productType && productType !== "all") {
            query.productType = productType;
        }

        const Category = require('../models/Category');
        const SubCategory = require('../models/SubCategory');
        const ChildCategory = require('../models/ChildCategory');

        const [products, total, categories, subcategories, childcategories] = await Promise.all([
            Product.find(query)
                .populate("category subCategory childCategory beautyTips")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Product.countDocuments(query),
            Category.find({ status: { $ne: 'deleted' } }).lean(),
            SubCategory.find({ status: { $ne: 'deleted' } }).lean(),
            ChildCategory.find({ status: { $ne: 'deleted' } }).lean()
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/admin_products', {
            products,
            page,
            totalPages,
            total,
            limit,
            query: req.query,
            categories,
            subcategories,
            childcategories
        });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).render('admin/admin_products', { products: [], error: 'Failed to load products', limit: 20, categories: [], subcategories: [], childcategories: [] });
    }
});

router.get('/orders', (req, res) => {
    res.render('admin/admin_orders');
});



router.get('/reseller_products', async (req, res) => {
    try {
        let { page = 1, limit = 20, search = "", status } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

        const query = {};

        if (status) {
            query.status = status;
        }

        if (search && search.trim() !== "") {
            const searchRegex = new RegExp(search.trim(), "i");
            query.$or = [
                { companyName: searchRegex },
                { contactName: searchRegex },
                { phone: searchRegex },
                { email: searchRegex }
            ];
        }

        const [resellers, total] = await Promise.all([
            Reseller.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Reseller.countDocuments(query)
        ]);
        const totalPages = Math.ceil(total / limit);

        res.render('admin/admin_reseller_product', {
            resellers,
            page,
            totalPages,
            total,
            query: req.query
        });
    } catch (err) {
        console.error('Error fetching resellers:', err);
        res.status(500).render('admin/admin_reseller_product', {
            resellers: [],
            error: 'Failed to load resellers'
        });
    }
});



module.exports = router;