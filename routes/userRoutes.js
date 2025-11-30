const express = require('express');
const router = express.Router();

const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const ChildCategory = require('../models/ChildCategory');
const Product = require('../models/Product');
const Testimonial = require('../models/Testimonials');
const Banner = require('../models/Banner');
const Poster = require('../models/Poster');

router.get('/', async (req, res) => {
    try {
        const [
            categories, 
            subcategories, 
            childcategories, 
            testimonials, 
            banners, 
            posters
        ] = await Promise.all([
            Category.find({ isActive: true }).lean(),
            SubCategory.find({ isActive: true }).lean(),
            ChildCategory.find({ isActive: true }).lean(),
            Testimonial.find({})
                .sort({ createdAt: -1 })
                .limit(12)
                .lean(),
            Banner.find({ isActive: true })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Poster.find({ isActive: true })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        let products = [];
        products = await Product.aggregate([
            { $match: { status: "approved" } },
            { $sample: { size: 4 } }
        ]);

        res.render('user/home', { categories, subcategories, childcategories, products, testimonials, banners, posters });
    } catch (err) {
        console.error("Error loading categories, products, banners, posters, or testimonials for home page:", err);
        res.render('user/home', {
            categories: [],
            subcategories: [],
            childcategories: [],
            products: [],
            testimonials: [],
            banners: [],
            posters: [],
            error: "Could not load categories, products, banners, posters, or testimonials"
        });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('user/about');
});
// Shop page
router.get(
  ['/shop', '/shop/:cat', '/shop/:cat/:sub', '/shop/:cat/:sub/:child'],
  async (req, res) => {
    try {
      let { cat, sub, child } = req.params;

      let {
        page = 1,
        limit = 12,
        sort,
        minPrice,
        maxPrice,
        brand,
        stock,
        search
      } = req.query;

      page = Number(page);
      limit = Number(limit);

      let filter = { status: "approved" };

      if (cat) {
        const catDoc = await Category.findOne({ slug: cat });
        if (catDoc) filter.category = catDoc._id;
      }

      if (sub) {
        const subDoc = await SubCategory.findOne({ slug: sub });
        if (subDoc) filter.subCategory = subDoc._id;
      }

      if (child) {
        const childDoc = await ChildCategory.findOne({ slug: child });
        if (childDoc) filter.childCategory = childDoc._id;
      }

      if (search) {
        filter.title = { $regex: search, $options: "i" };
      }

      let products = await Product.find(filter)
        .populate("category subCategory childCategory")
        .lean();

      products = products.map(p => {
        const finalPrice =
          p.adminSalePrice ??
          p.adminBasePrice ??
          p.salePrice ??
          p.basePrice;

        let priceVal = (typeof finalPrice === 'number' && !isNaN(finalPrice)) ? finalPrice : 0;
        let oldPriceVal = (
          typeof p.adminBasePrice === 'number'
            ? p.adminBasePrice
            : (typeof p.basePrice === 'number' ? p.basePrice : null)
        );
        return {
          ...p,
          finalPrice,
          price: priceVal,
          oldPrice: oldPriceVal
        };
      });

      if (minPrice || maxPrice) {
        products = products.filter(p => {
          if (minPrice && p.finalPrice < Number(minPrice)) return false;
          if (maxPrice && p.finalPrice > Number(maxPrice)) return false;
          return true;
        });
      }

      if (brand) {
        products = products.filter(p => {
          if (typeof p.brand === "object" && p.brand && p.brand.slug) {
            return p.brand.slug === brand;
          } else if (typeof p.brand === "string") {
            return p.brand.toLowerCase().replace(/\s+/g, "-") === brand;
          }
          return false;
        });
      }

      if (stock === "in") {
        products = products.filter(p => p.totalStock > 0);
      } else if (stock === "out") {
        products = products.filter(p => p.totalStock <= 0);
      }

      switch (sort) {
        case "best_selling":
          products.sort((a, b) => b.totalSold - a.totalSold);
          break;

        case "alpha_asc":
          products.sort((a, b) => a.title.localeCompare(b.title));
          break;

        case "alpha_desc":
          products.sort((a, b) => b.title.localeCompare(a.title));
          break;

        case "price_asc":
          products.sort((a, b) => a.finalPrice - b.finalPrice);
          break;

        case "price_desc":
          products.sort((a, b) => b.finalPrice - a.finalPrice);
          break;

        default:
          products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      const total = products.length;
      const start = (page - 1) * limit;
      const paginatedProducts = products.slice(start, start + limit);

      const totalPages = Math.ceil(total / limit);
      let pagination = {
        totalPages,
        currentPage: page,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        limit: limit
      };


      const categories = await Category.find({ isActive: true });
      const subCategories = await SubCategory.find({ isActive: true });
      const childCategories = await ChildCategory.find({ isActive: true });

      let brandAggResults = await Product.aggregate([
        { $match: { status: "approved", "brand.slug": { $exists: true, $ne: null } } },
        { $group: { _id: { slug: "$brand.slug", name: "$brand.name" } } },
        { $project: { slug: "$_id.slug", name: "$_id.name", _id: 0 } },
        { $sort: { name: 1 } }
      ]);
      let brands = Array.isArray(brandAggResults) ? brandAggResults : [];

      if (!brands.length) {
        const brandNames = await Product.distinct("brand", { status: "approved", brand: { $ne: null } });
        brands = brandNames
          .filter(val => !!val)
          .map(val =>
            typeof val === "string"
              ? { slug: val.toLowerCase().replace(/\s+/g, "-"), name: val }
              : { slug: val.slug, name: val.name }
          );
        brands = brands
          .filter(b => b.slug && b.name)
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      let selectedBrand = brand || null;

      const sortNameMap = {
        best_selling: "Best selling",
        alpha_asc: "Alphabetically, A-Z",
        alpha_desc: "Alphabetically, Z-A",
        price_asc: "Price, low to high",
        price_desc: "Price, high to low"
      };
      let sortName = sortNameMap[sort] || "Best selling";

      const appliedFilters = [];
      if (search) appliedFilters.push({ label: 'Search', value: search });
      if (cat && categories && categories.length) {
        const foundCat = categories.find(c => c.slug === cat);
        if (foundCat) appliedFilters.push({ label: 'Category', value: foundCat.name });
      }
      if (sub && subCategories && subCategories.length) {
        const foundSub = subCategories.find(sc => sc.slug === sub);
        if (foundSub) appliedFilters.push({ label: 'Subcategory', value: foundSub.name });
      }
      if (child && childCategories && childCategories.length) {
        const foundChild = childCategories.find(cc => cc.slug === child);
        if (foundChild) appliedFilters.push({ label: 'Child Category', value: foundChild.name });
      }
      if (brand && brands && brands.length) {
        const foundBrand = brands.find(b => b.slug === brand);
        if (foundBrand) appliedFilters.push({ label: 'Brand', value: foundBrand.name });
      }
      if (minPrice) appliedFilters.push({ label: 'Min Price', value: minPrice });
      if (maxPrice) appliedFilters.push({ label: 'Max Price', value: maxPrice });
      if (stock === "in") appliedFilters.push({ label: 'Stock', value: 'In Stock' });
      if (stock === "out") appliedFilters.push({ label: 'Stock', value: 'Out of Stock' });
      if (sortName && sort) appliedFilters.push({ label: 'Sort', value: sortName });

      return res.render("user/shop", {
        products: paginatedProducts,
        total,
        totalProducts: total,
        currentPage: page,
        totalPages: totalPages,
        pagination,

        filters: {
          search,
          sort,
          minPrice,
          maxPrice,
          brand,
          stock
        },

        slugs: { cat, sub, child },

        categories,
        subCategories,
        childCategories,

        brands,
        selectedBrand,
        sortName,
        appliedFilters
      });

    } catch (err) {
      console.error("SHOP PAGE ERROR:", err);
      return res.status(500).send("Failed to load shop page");
    }
  }
);
  
// product details page
router.get('/productDetails/:slug', (req, res) => {
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
router.get('/blogs', (req, res) => {
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
