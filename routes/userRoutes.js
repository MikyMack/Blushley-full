const express = require('express');
const router = express.Router();

const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const ChildCategory = require('../models/ChildCategory');
const Product = require('../models/Product');
const Testimonial = require('../models/Testimonials');
const Banner = require('../models/Banner');
const Poster = require('../models/Poster');
const Blog = require('../models/Blog');
const Freelancer = require('../models/Freelancer');
const Salon = require('../models/Salon');

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
            { $sample: { size: 20 } }
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
            let price, oldPrice;

            if (p.adminBasePrice !== undefined && p.adminBasePrice !== null) {

              if (p.adminSalePrice !== undefined && p.adminSalePrice !== null && p.adminSalePrice < p.adminBasePrice) {
           
                price = p.adminSalePrice;
                oldPrice = p.adminBasePrice;
              } else {
          
                price = p.adminBasePrice;
                oldPrice = null;
              }
            } else {
     
              if (p.salePrice !== undefined && p.salePrice !== null && p.salePrice < p.basePrice) {
         
                price = p.salePrice;
                oldPrice = p.basePrice;
              } else {
      
                price = p.basePrice;
                oldPrice = null;
              }
            }

            const priceVal = (typeof price === 'number' && !isNaN(price)) ? price : 0;
            const oldPriceVal = (typeof oldPrice === 'number' && !isNaN(oldPrice)) ? oldPrice : null;
            
            return {
              ...p,
              finalPrice: priceVal,
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


router.get('/productDetails/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;

        const processProductPrices = (p) => {
            let price, oldPrice;
            
            const useAdminPrices = p.adminBasePrice !== undefined && p.adminBasePrice !== null;
            const basePrice = useAdminPrices ? p.adminBasePrice : p.basePrice;
            const salePrice = useAdminPrices ? p.adminSalePrice : p.salePrice;

            if (salePrice !== undefined && salePrice !== null && salePrice < basePrice) {
                price = salePrice;
                oldPrice = basePrice;
            } else {
                price = basePrice;
                oldPrice = null;
            }

            const priceVal = (typeof price === 'number' && !isNaN(price)) ? price : 0;
            const oldPriceVal = (typeof oldPrice === 'number' && !isNaN(oldPrice)) ? oldPrice : null;

            return {
                ...p,
                finalPrice: priceVal,
                price: priceVal,
                oldPrice: oldPriceVal
            };
        };

        const product = await Product.findOne({ slug })
            .populate('category')
            .populate('subCategory')
            .populate('childCategory')
            .populate('beautyTips')
            .lean();

        if (!product) return res.status(404).render("errors/404", { message: "Product Not Found" });

        const processedProduct = processProductPrices(product);

        let relatedQuery = {
            status: "approved",
            _id: { $ne: product._id }
        };

        if (product.childCategory) {
            relatedQuery.childCategory = product.childCategory._id || product.childCategory;
        } else if (product.subCategory) {
            relatedQuery.subCategory = product.subCategory._id || product.subCategory;
        } else if (product.category) {
            relatedQuery.category = product.category._id || product.category;
        }

        const relatedProducts = await Product.find(relatedQuery)
            .sort({ createdAt: -1 })
            .limit(8)
            .lean()
            .then(products => products.map(processProductPrices));

        let fbtQueryBase = {
            status: "approved",
            _id: { $ne: product._id }
        };

        const matchCriteria = [];

        if (product.childCategory) {
            matchCriteria.push({
                childCategory: product.childCategory._id || product.childCategory,
                subCategory: product.subCategory._id || product.subCategory,
                category: product.category._id || product.category
            });
        }
    
        if (product.subCategory) {
            matchCriteria.push({
                subCategory: product.subCategory._id || product.subCategory,
                category: product.category._id || product.category
            });
        }
  
        if (product.category) {
            matchCriteria.push({
                category: product.category._id || product.category
            });
        }
   
        if (product.brand && product.brand.trim()) {
            matchCriteria.push({
                brand: product.brand
            });
        }

        if (product.tags && product.tags.length > 0) {
            matchCriteria.push({
                tags: { $in: product.tags }
            });
        }

        let frequentlyBoughtTogether = [];
        let excludeIds = [product._id];

        const pickRandomSubset = (arr, count) => {
            // Shuffle the array and pick first N
            if (!arr || !arr.length) return [];
            const shuffled = arr.slice().sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count);
        };

        for (const criteria of matchCriteria) {
            if (frequentlyBoughtTogether.length >= 3) break;

            const query = { ...fbtQueryBase, ...criteria, _id: { $nin: excludeIds } };
            // Fetch more than needed for better random selection
            let matchedProducts = await Product.find(query)
                .sort({ totalSold: -1, rating: -1 })
                .limit(10)
                .lean();

            // Exclude those that already exist in FBT (by _id)
            matchedProducts = matchedProducts.filter(p => !excludeIds.some(id => String(id) === String(p._id)));

            // Randomly pick up to remaining needed slots
            const needed = 3 - frequentlyBoughtTogether.length;
            const picked = pickRandomSubset(matchedProducts, needed).map(processProductPrices);

            frequentlyBoughtTogether.push(...picked);
            excludeIds.push(...picked.map(p => p._id));
        }

        // Supplement - best sellers in same main category (not already chosen)
        if (frequentlyBoughtTogether.length < 3 && product.category) {
            const needed = 3 - frequentlyBoughtTogether.length;
            let more = await Product.find({
                status: "approved",
                category: product.category._id || product.category,
                _id: { $nin: excludeIds }
            })
            .sort({ totalSold: -1, rating: -1 })
            .limit(10)
            .lean();

            more = more.filter(p => !excludeIds.some(id => String(id) === String(p._id)));
            const picked = pickRandomSubset(more, needed).map(processProductPrices);

            frequentlyBoughtTogether.push(...picked);
            excludeIds.push(...picked.map(p => p._id));
        }

        // Final fallback - any approved products (not already chosen)
        if (frequentlyBoughtTogether.length < 3) {
            const needed = 3 - frequentlyBoughtTogether.length;
            let more = await Product.find({
                status: "approved",
                _id: { $nin: excludeIds }
            })
            .sort({ totalSold: -1, rating: -1 })
            .limit(10)
            .lean();

            more = more.filter(p => !excludeIds.some(id => String(id) === String(p._id)));
            const picked = pickRandomSubset(more, needed).map(processProductPrices);

            frequentlyBoughtTogether.push(...picked);
            excludeIds.push(...picked.map(p => p._id));
        }

        // Trim in case random picks overfilled (shouldn't, but be safe)
        frequentlyBoughtTogether = frequentlyBoughtTogether.slice(0, 3);

        return res.render('user/productDetails', {
            product: processedProduct,
            relatedProducts,
            frequentlyBoughtTogether
        });
    } catch (err) {
        console.error("Error loading product details:", err);
        return res.status(500).render('errors/500', { message: "Failed to load product details" });
    }
});
// userlogin 
router.get('/userLogin', (req, res) => {
    res.render('user/userLogin');
});
// saloon at home 


router.get('/saloon-at-home', async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            service,  // serviceId or array
            city,
            state,
            pincode,
            availableDate,
            minPrice,
            maxPrice
        } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;

        const query = {};

        // Filter by freelancer service(s)
        if (service) {
            // Can be string or array
            if (Array.isArray(service)) {
                query['freelancerServices.serviceId'] = { $in: service };
            } else {
                query['freelancerServices.serviceId'] = service;
            }
        }

        // Filter by location
        if (city) {
            query['locations.city'] = city;
        }
        if (state) {
            query['locations.state'] = state;
        }
        if (pincode) {
            query['locations.pincode'] = pincode;
        }

        // Price Range Filter
        if (minPrice || maxPrice) {
            query['freelancerServices.finalPrice'] = {};
            if (minPrice !== undefined && minPrice !== "") {
                query['freelancerServices.finalPrice'].$gte = Number(minPrice);
            }
            if (maxPrice !== undefined && maxPrice !== "") {
                query['freelancerServices.finalPrice'].$lte = Number(maxPrice);
            }
        }

        // Optional: Only show approved and active freelancers
        query.status = 'approved';

        // Filter for available date (simplistic - checks if any day in 'availability' array matches given day)
        if (availableDate) {
            // availableDate expected as 'YYYY-MM-DD'
            const dateObj = new Date(availableDate);
            if (!isNaN(dateObj)) {
                // Sunday = 0, ..., Saturday=6
                const dayOfWeek = dateObj.getDay();
                query['availability.dayOfWeek'] = dayOfWeek;
            }
        }

        // Count total for pagination
        const totalFreelancers = await Freelancer.countDocuments(query);

        // Pagination
        const freelancers = await Freelancer.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Helper: Expand the population with service pricing for ease of UI
        // (Note: For each freelancer, only the matching services may be shown in frontend.)

        res.render('user/saloonAtHome', {
            freelancers,
            pagination: {
                page,
                limit,
                total: totalFreelancers,
                totalPages: Math.ceil(totalFreelancers / limit)
            },
            filtersIn: { service, city, state, pincode, availableDate, minPrice, maxPrice }
        });
    } catch (err) {
        console.error("Error loading freelancers for saloon-at-home:", err);
        res.render('user/saloonAtHome', {
            freelancers: [],
            pagination: {
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 1
            },
            filtersIn: req.query || {},
            error: "Could not load freelancers"
        });
    }
});

// book a saloon 
router.get('/book-a-saloon', async (req, res) => {
    try {
      // For AJAX requests, return JSON
      if (req.headers['x-requested-with'] === 'XMLHttpRequest' || 
          req.path.includes('/api/')) {
        // Continue to existing logic for API calls
        const {
          page = 1,
          limit = 12,
          services,
          location,
          rating,
          price_min,
          price_max,
          sort = 'rating'
        } = req.query;
  
        // Build match query
        let match = { status: 'active' };
        
        // Location filter
        if (location) {
          const locationRegex = new RegExp(location, 'i');
          match.$or = [
            { 'address.city': locationRegex },
            { 'address.state': locationRegex },
            { 'address.pincode': locationRegex }
          ];
          match['address.state'] = { $regex: /kerala/i };
        } else {
          match['address.state'] = { $regex: /kerala/i };
        }
        
        // Service filter
        if (services) {
          const serviceArray = services.split(',');
          match['services.serviceName'] = { 
            $in: serviceArray.map(s => new RegExp(s, 'i'))
          };
        }
        
        // Rating filter
        if (rating) {
          match['reviews.rating'] = { $gte: parseFloat(rating) };
        }
        
        // Price filter
        if (price_min || price_max) {
          match['services.price'] = {};
          if (price_min) match['services.price'].$gte = parseFloat(price_min);
          if (price_max) match['services.price'].$lte = parseFloat(price_max);
        }
        
        // Sort options
        let sortOpt = {};
        switch (sort) {
          case 'price_low':
            sortOpt = { minPrice: 1 };
            break;
          case 'price_high':
            sortOpt = { minPrice: -1 };
            break;
          case 'rating':
          default:
            sortOpt = { avgRating: -1 };
        }
        
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        
        // Aggregation pipeline
        const pipeline = [
          { $match: match },
          {
            $addFields: {
              avgRating: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$reviews', []] } }, 0] },
                  { $avg: '$reviews.rating' },
                  0
                ]
              },
              minPrice: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$services', []] } }, 0] },
                  { $min: '$services.price' },
                  0
                ]
              },
              topServices: {
                $slice: [
                  {
                    $setUnion: [
                      { $map: { input: '$services', as: 's', in: '$$s.serviceName' } },
                      []
                    ]
                  },
                  3
                ]
              },
              isAvailableToday: {
                $let: {
                  vars: { today: new Date().getDay() },
                  in: {
                    $anyElementTrue: {
                      $map: {
                        input: { $ifNull: ['$availability', []] },
                        as: 'avail',
                        in: {
                          $and: [
                            { $eq: ['$$avail.dayOfWeek', '$$today'] },
                            { $eq: ['$$avail.isOpen', true] }
                          ]
                        }
                      }
                    }
                  }
                }
              },
              locationText: {
                $cond: [
                  { $and: ['$address.city', '$address.state'] },
                  { $concat: ['$address.city', ', ', '$address.state'] },
                  { $ifNull: ['$address.city', '$address.state', ''] }
                ]
              }
            }
          },
          { $sort: sortOpt },
          { $skip: skip },
          { $limit: limitNum }
        ];
        
        const [salons, total] = await Promise.all([
          Salon.aggregate(pipeline),
          Salon.countDocuments(match)
        ]);
        
        const formattedSalons = salons.map(salon => ({
          _id: salon._id,
          name: salon.name,
          image: salon.images?.[0],
          rating: salon.avgRating || 0,
          reviewCount: salon.reviews?.length || 0,
          location: salon.locationText,
          startingPrice: salon.minPrice || 0,
          minPrice: salon.minPrice || 0,
          homeService: salon.serviceMode?.homeService || false,
          topServices: salon.topServices || [],
          isAvailableToday: salon.isAvailableToday || false
        }));
        
        return res.json({
          success: true,
          salons: formattedSalons,
          totalCount: total,
          hasMore: total > (pageNum * limitNum)
        });
      }
      
      // For regular page load, render the new template
      res.render("user/saloon-service", {
        title: "Book Salon Services"
      });
      
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to load data" 
      });
    }
  });

// Salon details route
// Salon details route
router.get('/book-a-saloon/:id', async (req, res) => {
    try {
      const salon = await Salon.findById(req.params.id).lean();
      
      if (!salon) {
        return res.status(404).render('error', {
          title: 'Salon Not Found',
          message: 'The salon you are looking for does not exist.'
        });
      }
  
      // Calculate average rating
      const avgRating = salon.reviews && salon.reviews.length > 0
        ? (salon.reviews.reduce((sum, review) => sum + review.rating, 0) / salon.reviews.length).toFixed(1)
        : "0.0";
  
      // Group services by category (first word)
      const servicesByCategory = {};
      salon.services?.forEach(service => {
        const firstWord = service.serviceName.split(' ')[0];
        if (!servicesByCategory[firstWord]) {
          servicesByCategory[firstWord] = [];
        }
        servicesByCategory[firstWord].push(service);
      });
  
      // Check if user is logged in
      const isLoggedIn = req.session.userId ? true : false;
  
      // Get current URL for redirect
      const currentUrl = req.originalUrl;
  
      // Format availability
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date().getDay();
      const todayAvailability = salon.availability.find(a => a.dayOfWeek === today);
  
      res.render('user/salon-details', {
        title: `${salon.name} - Book Salon Services`,
        salon: {
          ...salon,
          avgRating,
          reviewCount: salon.reviews?.length || 0,
          servicesByCategory,
          locationText: `${salon.address?.line1 || ''}, ${salon.address?.city || ''}, ${salon.address?.state || ''}`,
          todayAvailability: todayAvailability || { openingTime: '9:00', closingTime: '18:00', isOpen: true }
        },
        isLoggedIn,
        currentUrl
      });
  
    } catch (error) {
      console.error('Error fetching salon details:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load salon details. Please try again.'
      });
    }
  });
  
  // Add new route for booking initialization
  router.get('/api/salon/:id/booking/initialize', async (req, res) => {
    try {
      const salon = await Salon.findById(req.params.id).select('name services availability');
      
      if (!salon) {
        return res.status(404).json({ success: false, message: 'Salon not found' });
      }
  
      // Get next 30 days availability
      const next30Days = [];
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const dayOfWeek = date.getDay();
        const dayAvailability = salon.availability.find(a => a.dayOfWeek === dayOfWeek);
        
        // Check if closed on this date
        const isClosed = salon.closedDates?.some(closedDate => 
          new Date(closedDate).toDateString() === date.toDateString()
        );
        
        next30Days.push({
          date: date.toISOString().split('T')[0],
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNumber: date.getDate(),
          monthName: date.toLocaleDateString('en-US', { month: 'short' }),
          isAvailable: dayAvailability?.isOpen && !isClosed,
          openingTime: dayAvailability?.openingTime,
          closingTime: dayAvailability?.closingTime
        });
      }
  
      // Format services
      const services = salon.services?.map(service => ({
        id: service._id,
        name: service.serviceName,
        price: service.price,
        duration: service.durationMinutes || 30
      })) || [];
  
      res.json({
        success: true,
        salon: {
          name: salon.name,
          services: services
        },
        availability: next30Days
      });
  
    } catch (error) {
      console.error('Error initializing booking:', error);
      res.status(500).json({ success: false, message: 'Failed to initialize booking' });
    }
  });
  
  // Add route to create booking
  router.post('/api/booking/create', async (req, res) => {
    try {
      const {
        salonId,
        serviceIds,
        bookingDate,
        bookingTime,
        bookingType,
        userNotes,
        homeAddress,
        googleMapLink
      } = req.body;
  
      // Check if user is logged in
      if (!req.session.userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Please login to book services' 
        });
      }
  
      // Get salon details
      const salon = await Salon.findById(salonId);
      if (!salon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Salon not found' 
        });
      }
  
      // Get selected services
      const selectedServices = salon.services.filter(service => 
        serviceIds.includes(service._id.toString())
      );
  
      if (selectedServices.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No services selected' 
        });
      }
  
      // Calculate total price
      const totalAmount = selectedServices.reduce((sum, service) => sum + service.price, 0);
      const totalDuration = selectedServices.reduce((sum, service) => 
        sum + (service.durationMinutes || 30), 0
      );
  
      // Generate booking token
      const bookingToken = 'BK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  
      // Create booking
      const booking = new SalonBooking({
        bookingToken,
        user: {
          userId: req.session.userId,
          name: req.session.userName || 'Customer',
          phone: req.session.userPhone,
          email: req.session.userEmail
        },
        salon: {
          salonId: salon._id,
          salonName: salon.name,
          salonPhone: salon.phone
        },
        services: selectedServices.map(service => ({
          serviceId: service._id,
          serviceName: service.serviceName,
          basePrice: service.price,
          adminPrice: service.adminPrice,
          durationMinutes: service.durationMinutes
        })),
        bookingType,
        bookingDate: new Date(bookingDate),
        bookingTime,
        paymentBreakdown: {
          totalServiceAmount: totalAmount,
          customerPaid: totalAmount,
          salonEarning: totalAmount * 0.8 // Example: 80% to salon, 20% platform commission
        },
        payment: {
          method: 'online',
          status: 'pending'
        },
        status: 'pending',
        userNotes
      });
  
      // Add home service location if applicable
      if (bookingType === 'home' && homeAddress) {
        booking.homeServiceLocation = {
          fullAddress: homeAddress,
          city: salon.address.city,
          state: salon.address.state,
          pincode: salon.address.pincode,
          googleMapLink: googleMapLink || ''
        };
      } else {
        booking.salonLocation = {
          address: `${salon.address.line1}, ${salon.address.city}, ${salon.address.state} - ${salon.address.pincode}`,
          googleMapLink: salon.googleMapLink || ''
        };
      }
  
      await booking.save();
  
      // Update salon stats
      await Salon.findByIdAndUpdate(salonId, {
        $inc: {
          totalBookings: 1,
          totalEarnings: totalAmount
        }
      });
  
      res.json({
        success: true,
        message: 'Booking created successfully',
        booking: {
          id: booking._id,
          token: booking.bookingToken,
          totalAmount,
          bookingDate,
          bookingTime
        }
      });
  
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create booking' 
      });
    }
  });
router.get('/api/search/global', async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.json({
          success: true,
          results: {
            services: [],
            salons: [],
            suggestions: []
          }
        });
      }
      
      const searchRegex = new RegExp(q, 'i');
      
      // Search services
      const services = await Salon.aggregate([
        { $match: { status: 'active' } },
        { $unwind: '$services' },
        { $match: { 'services.serviceName': searchRegex } },
        {
          $group: {
            _id: '$services.serviceName',
            price: { $min: '$services.price' },
            salonCount: { $sum: 1 }
          }
        },
        { $limit: 10 }
      ]);
      
      // Search salons
      const salons = await Salon.aggregate([
        { $match: { 
          status: 'active',
          $or: [
            { name: searchRegex },
            { description: searchRegex },
            { 'address.city': searchRegex }
          ]
        }},
        {
          $project: {
            name: 1,
            images: 1,
            address: 1,
            rating: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$reviews', []] } }, 0] },
                { $avg: '$reviews.rating' },
                0
              ]
            },
            reviewCount: { $size: { $ifNull: ['$reviews', []] } }
          }
        },
        { $limit: 10 }
      ]);
      
      // Get popular search suggestions
      const suggestions = [
        'Haircut',
        'Facial',
        'Manicure',
        'Pedicure',
        'Waxing',
        'Threading',
        'Hair Color',
        'Skin Treatment'
      ].filter(s => s.toLowerCase().includes(q.toLowerCase()));
      
      res.json({
        success: true,
        results: {
          services: services.map(s => ({
            name: s._id,
            price: s.price,
            salonCount: s.salonCount
          })),
          salons: salons.map(s => ({
            _id: s._id,
            name: s.name,
            image: s.images?.[0],
            location: `${s.address?.city || ''}, ${s.address?.state || ''}`,
            rating: s.rating,
            reviewCount: s.reviewCount
          })),
          suggestions
        }
      });
      
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, error: 'Search failed' });
    }
  });
// Location-based routes
router.get('/api/locations/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                locations: []
            });
        }
        
        // Search for Kerala cities
        const keralaCities = [
            { name: 'Thiruvananthapuram', state: 'Kerala', type: 'city' },
            { name: 'Kochi', state: 'Kerala', type: 'city' },
            { name: 'Kozhikode', state: 'Kerala', type: 'city' },
            { name: 'Thrissur', state: 'Kerala', type: 'city' },
            { name: 'Kollam', state: 'Kerala', type: 'city' },
            { name: 'Alappuzha', state: 'Kerala', type: 'city' },
            { name: 'Kannur', state: 'Kerala', type: 'city' },
            { name: 'Kottayam', state: 'Kerala', type: 'city' },
            { name: 'Malappuram', state: 'Kerala', type: 'city' },
            { name: 'Palakkad', state: 'Kerala', type: 'city' },
            { name: 'Manjeri', state: 'Kerala', type: 'city' },
            { name: 'Thalassery', state: 'Kerala', type: 'city' },
            { name: 'Ponnani', state: 'Kerala', type: 'city' },
            { name: 'Vatakara', state: 'Kerala', type: 'city' },
            { name: 'Kanhangad', state: 'Kerala', type: 'city' }
        ];
        
        const searchTerm = q.toLowerCase();
        const filteredCities = keralaCities.filter(city => 
            city.name.toLowerCase().includes(searchTerm)
        );
        
        // Also search in database
        const dbLocations = await Salon.aggregate([
            {
                $match: {
                    status: 'active',
                    $or: [
                        { 'address.city': { $regex: q, $options: 'i' } },
                        { 'address.state': { $regex: q, $options: 'i' } },
                        { 'address.pincode': { $regex: q, $options: 'i' } }
                    ]
                }
            },
            {
                $group: {
                    _id: { 
                        city: '$address.city',
                        state: '$address.state'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        const allLocations = [
            ...filteredCities.map(city => ({
                name: city.name,
                state: city.state,
                type: city.type,
                salonCount: 0
            })),
            ...dbLocations.map(loc => ({
                name: loc._id.city,
                state: loc._id.state,
                type: 'database',
                salonCount: loc.count
            }))
        ];
        
        // Remove duplicates
        const uniqueLocations = [];
        const seen = new Set();
        
        allLocations.forEach(loc => {
            const key = `${loc.name}-${loc.state}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueLocations.push(loc);
            }
        });
        
        res.json({
            success: true,
            locations: uniqueLocations.slice(0, 10)
        });
        
    } catch (error) {
        console.error('Location search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to search locations' 
        });
    }
});

// Service categories
router.get('/api/service-categories', async (req, res) => {
    try {
        // Get categories from existing salons
        const categories = await Salon.aggregate([
            { $match: { status: 'active' } },
            { $unwind: '$services' },
            {
                $addFields: {
                    category: {
                        $cond: [
                            { $regexMatch: { input: '$services.serviceName', regex: /hair|cut|trim|style|colour|color|shampoo/i } },
                            'hair',
                            {
                                $cond: [
                                    { $regexMatch: { input: '$services.serviceName', regex: /facial|skin|cleanup|treatment|bleach|threading/i } },
                                    'skin',
                                    {
                                        $cond: [
                                            { $regexMatch: { input: '$services.serviceName', regex: /nail|manicure|pedicure/i } },
                                            'nails',
                                            'other'
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    name: {
                        $first: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$category', 'hair'] }, then: 'Hair Services' },
                                    { case: { $eq: ['$category', 'skin'] }, then: 'Skin & Facial' },
                                    { case: { $eq: ['$category', 'nails'] }, then: 'Nail Services' }
                                ],
                                default: 'Other Services'
                            }
                        }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Add "All Services" as first category
        const totalServices = await Salon.aggregate([
            { $match: { status: 'active' } },
            { $project: { serviceCount: { $size: '$services' } } },
            { $group: { _id: null, total: { $sum: '$serviceCount' } } }
        ]);

        const allCategory = {
            id: 'all',
            name: 'All Services',
            count: totalServices[0]?.total || 0
        };

        const allCategories = [allCategory, ...categories.map(cat => ({
            id: cat._id,
            name: cat.name,
            count: cat.count
        }))];

        res.json({
            success: true,
            categories: allCategories
        });

    } catch (error) {
        console.error('Error loading categories:', error);
        // Return fallback categories
        res.json({
            success: true,
            categories: [
                { id: 'all', name: 'All Services', count: 100 },
                { id: 'hair', name: 'Hair Services', count: 45 },
                { id: 'skin', name: 'Skin & Facial', count: 30 },
                { id: 'nails', name: 'Nail Services', count: 20 },
                { id: 'other', name: 'Other Services', count: 5 }
            ]
        });
    }
});

// Get all services
router.get('/api/services', async (req, res) => {
    try {
        const { category } = req.query;
        
        let match = { status: 'active' };
        
        if (category && category !== 'all') {
            // Build regex based on category
            let categoryRegex;
            switch(category) {
                case 'hair':
                    categoryRegex = /hair|cut|trim|style|styling|colour|color|shampoo|condition|keratin|straighten/i;
                    break;
                case 'skin':
                    categoryRegex = /facial|skin|cleanup|treatment|bleach|threading|wax|polish|glow|whitening/i;
                    break;
                case 'nails':
                    categoryRegex = /nail|manicure|pedicure|cuticle|polish|art/i;
                    break;
                default:
                    categoryRegex = /./; // Match everything
            }
            
            match['services.serviceName'] = { $regex: categoryRegex };
        }
        
        const services = await Salon.aggregate([
            { $match: match },
            { $unwind: '$services' },
            {
                $group: {
                    _id: '$services.serviceName',
                    price: { $min: '$services.price' },
                    duration: { $first: { $ifNull: ['$services.durationMinutes', 60] } },
                    salonCount: { $sum: 1 },
                    category: {
                        $first: {
                            $cond: [
                                { $regexMatch: { input: '$services.serviceName', regex: /hair|cut|trim|style|colour|color|shampoo/i } },
                                'hair',
                                {
                                    $cond: [
                                        { $regexMatch: { input: '$services.serviceName', regex: /facial|skin|cleanup|treatment|bleach|threading/i } },
                                        'skin',
                                        {
                                            $cond: [
                                                { $regexMatch: { input: '$services.serviceName', regex: /nail|manicure|pedicure/i } },
                                                'nails',
                                                'other'
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            },
            { 
                $match: category && category !== 'all' ? { category: category } : {} 
            },
            { $sort: { salonCount: -1 } },
            { $limit: 50 }
        ]);

        const formattedServices = services.map(service => ({
            id: service._id.replace(/\s+/g, '-').toLowerCase(),
            name: service._id,
            price: service.price,
            duration: service.duration,
            salonCount: service.salonCount,
            category: service.category
        }));

        res.json({
            success: true,
            services: formattedServices
        });

    } catch (error) {
        console.error('Error loading services:', error);
        // Return fallback services
        res.json({
            success: true,
            services: [
                { id: 'haircut', name: 'Haircut & Styling', price: 300, duration: 45, salonCount: 25 },
                { id: 'hair-color', name: 'Hair Coloring', price: 1200, duration: 120, salonCount: 18 },
                { id: 'facial', name: 'Basic Facial', price: 800, duration: 60, salonCount: 22 },
                { id: 'manicure', name: 'Manicure', price: 400, duration: 45, salonCount: 20 },
                { id: 'pedicure', name: 'Pedicure', price: 500, duration: 60, salonCount: 18 },
                { id: 'waxing', name: 'Body Waxing', price: 600, duration: 45, salonCount: 15 },
                { id: 'threading', name: 'Face Threading', price: 150, duration: 30, salonCount: 28 },
                { id: 'bleach', name: 'Face Bleach', price: 350, duration: 45, salonCount: 16 }
            ]
        });
    }
});

// Get salons with location and service filters
router.get('/api/salons', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 9,
            services,
            location,
            lat,
            lng,
            sort = 'rating',
            rating,
            price_min,
            price_max
        } = req.query;
        
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        
        // Build match query
        let match = { status: 'active' };
        
        // Location filter - prioritize Kerala
        if (location) {
            const locationRegex = new RegExp(location, 'i');
            match.$or = [
                { 'address.city': locationRegex },
                { 'address.state': locationRegex },
                { 'address.pincode': locationRegex }
            ];
            
            // Always filter by Kerala if state is not specified
            if (!match['address.state']) {
                match['address.state'] = { $regex: /kerala/i };
            }
        } else {
            // Default to Kerala if no location specified
            match['address.state'] = { $regex: /kerala/i };
        }
        
        // Service filter
        if (services) {
            const serviceArray = services.split(',');
            match['services.serviceName'] = { 
                $in: serviceArray.map(s => new RegExp(s.replace('-', ' '), 'i'))
            };
        }
        
        // Rating filter
        if (rating) {
            match['reviews.rating'] = { $gte: parseFloat(rating) };
        }
        
        // Price filter
        if (price_min || price_max) {
            match['services.price'] = {};
            if (price_min) match['services.price'].$gte = parseFloat(price_min);
            if (price_max) match['services.price'].$lte = parseFloat(price_max);
        }
        
        // Sort options
        let sortOpt = {};
        switch (sort) {
            case 'rating':
                sortOpt = { avgRating: -1 };
                break;
            case 'price_low':
                sortOpt = { minPrice: 1 };
                break;
            case 'price_high':
                sortOpt = { minPrice: -1 };
                break;
            case 'distance':
                // If we have coordinates, we could sort by distance
                // For now, default to rating
                sortOpt = { avgRating: -1 };
                break;
            default:
                sortOpt = { createdAt: -1 };
        }
        
        // Aggregation pipeline
        const pipeline = [
            { $match: match },
            {
                $addFields: {
                    // Calculate average rating
                    avgRating: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$reviews', []] } }, 0] },
                            { $avg: '$reviews.rating' },
                            0
                        ]
                    },
                    // Get minimum price
                    minPrice: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$services', []] } }, 0] },
                            {
                                $min: {
                                    $map: {
                                        input: '$services',
                                        as: 'service',
                                        in: '$$service.price'
                                    }
                                }
                            },
                            0
                        ]
                    },
                    // Get top services
                    topServices: {
                        $slice: [
                            {
                                $setUnion: [
                                    {
                                        $map: {
                                            input: '$services',
                                            as: 'service',
                                            in: '$$service.serviceName'
                                        }
                                    },
                                    []
                                ]
                            },
                            4
                        ]
                    },
                    // Check if open today
                    isAvailableToday: {
                        $let: {
                            vars: {
                                today: new Date().getDay()
                            },
                            in: {
                                $anyElementTrue: {
                                    $map: {
                                        input: { $ifNull: ['$availability', []] },
                                        as: 'avail',
                                        in: {
                                            $and: [
                                                { $eq: ['$$avail.dayOfWeek', '$$today'] },
                                                { $eq: ['$$avail.isOpen', true] }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    // Location text
                    locationText: {
                        $cond: [
                            { $and: ['$address.city', '$address.state'] },
                            { $concat: ['$address.city', ', ', '$address.state'] },
                            { $ifNull: ['$address.city', '$address.state', 'Location not specified'] }
                        ]
                    }
                }
            },
            { $sort: sortOpt },
            { $skip: skip },
            { $limit: limitNum + 1 } // Get one extra to check if there's more
        ];
        
        const salons = await Salon.aggregate(pipeline);
        
        // Check if there are more results
        const hasMore = salons.length > limitNum;
        const results = hasMore ? salons.slice(0, -1) : salons;
        
        // Format response
        const formattedSalons = results.map(salon => ({
            _id: salon._id,
            name: salon.name,
            image: salon.images && salon.images[0] ? salon.images[0] : null,
            rating: salon.avgRating || 0,
            reviewCount: salon.reviews ? salon.reviews.length : 0,
            location: salon.locationText,
            startingPrice: salon.minPrice || 0,
            minPrice: salon.minPrice || 0,
            homeService: salon.serviceMode?.homeService || false,
            topServices: salon.topServices || [],
            services: salon.services?.map(s => s.serviceName) || [],
            isAvailableToday: salon.isAvailableToday || false,
            description: salon.description || ''
        }));
        
        // Get total count for the first page
        let totalCount = formattedSalons.length;
        if (pageNum === 1) {
            const countResult = await Salon.countDocuments(match);
            totalCount = countResult;
        }
        
        res.json({
            success: true,
            salons: formattedSalons,
            hasMore,
            currentPage: pageNum,
            totalCount: totalCount
        });
        
    } catch (error) {
        console.error('Error fetching salons:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
// Helper function for category regex
function getCategoryRegex(category) {
    const categoryMap = {
        'hair': 'Hair|Cut|Trim|Styling|Colour|Color',
        'skin': 'Facial|Skin|Cleanup|Treatment',
        'nails': 'Nail|Manicure|Pedicure',
        'other': '.*'
    };
    
    return categoryMap[category] || '.*';
}
// Get salon by ID
router.get('/salons/:id', async (req, res) => {
    try {
        const salon = await Salon.findById(req.params.id).lean();
        if (!salon) {
            return res.status(404).json({
                success: false,
                message: 'Salon not found'
            });
        }
        
        res.json({
            success: true,
            salon
        });
    } catch (error) {
        console.error('Error fetching salon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salon'
        });
    }
  });
  
  // Get salon services
  router.get('/salons/:id/services', async (req, res) => {
    try {
        const salon = await Salon.findById(req.params.id).select('services').lean();
        if (!salon) {
            return res.status(404).json({
                success: false,
                message: 'Salon not found'
            });
        }
        
        res.json({
            success: true,
            services: salon.services || []
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services'
        });
    }
  });
  
  // Get salon availability
  router.get('/salons/:id/availability/:date', async (req, res) => {
    try {
        const { id, date } = req.params;
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();
        
        const salon = await Salon.findById(id).select('availability closedDates').lean();
        if (!salon) {
            return res.status(404).json({
                success: false,
                message: 'Salon not found'
            });
        }
        
        // Check if closed on this date
        const isClosed = salon.closedDates.some(closedDate => 
            new Date(closedDate).toDateString() === dateObj.toDateString()
        );
        
        if (isClosed) {
            return res.json({
                success: true,
                isOpen: false,
                message: 'Salon is closed on this date'
            });
        }
        
        // Get availability for this day
        const dayAvailability = salon.availability.find(
            avail => avail.dayOfWeek === dayOfWeek
        );
        
        res.json({
            success: true,
            isOpen: dayAvailability?.isOpen || false,
            availability: dayAvailability
        });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch availability'
        });
    }
  });

// Contact page
router.get('/contact', (req, res) => {
    res.render('user/contact');
});
// blogs 
router.get('/userblogs', async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 6;
        if (limit > 24) limit = 24;

        const filter = { status: "published" };

        const totalBlogs = await Blog.countDocuments(filter);
        const totalPages = Math.ceil(totalBlogs / limit);
        const skip = (page - 1) * limit;

        const blogs = await Blog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('user/beauty-tips', {
            blogs,
            pagination: {
                page,
                totalPages,
                totalBlogs,
                limit
            }
        });
    } catch (err) {
        console.error("Error fetching blogs for /blogs page:", err);
        res.render('user/beauty-tips', {
            blogs: [],
            pagination: {
                page: 1,
                totalPages: 1,
                totalBlogs: 0,
                limit: 6
            },
            error: 'Could not load blogs'
        });
    }
});
// blogs details 
router.get('/userblogs/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const blog = await Blog.findOne({ slug, status: 'published' }).lean();
        if (!blog) {
            return res.status(404).render('user/beautyDetails', { 
                blog: null, 
                relatedBlogs: [], 
                error: 'Blog not found' 
            });
        }

        let relatedblogs = [];
        if (blog.category) {
          relatedblogs = await Blog.find({ 
                _id: { $ne: blog._id },
                category: blog.category,
                status: 'published'
            })
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();
        }

        if (!relatedblogs || relatedblogs.length < 4) {
            const excludeIds = [blog._id, ...(relatedblogs ? relatedblogs.map(b => b._id) : [])];
            const moreBlogs = await Blog.find({
                _id: { $nin: excludeIds },
                status: 'published'
            })
            .sort({ createdAt: -1 })
            .limit(4 - (relatedblogs ? relatedblogs.length : 0))
            .lean();

            relatedblogs = (relatedblogs || []).concat(moreBlogs);
        }

        res.render('user/beautyDetails', {
            blog,
            relatedblogs
        });
    } catch (err) {
        console.error("Error loading blog details for slug:", req.params.slug, err);
        res.status(500).render('user/beautyDetails', {
            blog: null,
            relatedBlogs: [],
            error: 'Could not load blog details'
        });
    }
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
