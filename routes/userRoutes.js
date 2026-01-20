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
            { $sample: { size: 18 } }
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
      const {
          page = 1,
          limit = 6,
          service,
          price_min,
          price_max,
          availability,
          gender,
          location,
          rating,
          service_mode,
          sort = 'top-rated'
      } = req.query;

      // Build filter query
      let filter = { status: 'active' };
      
      // Service filter
      if (service) {
          filter['services.serviceName'] = { 
              $regex: service, 
              $options: 'i' 
          };
      }
      
      // Price range filter
      if (price_min || price_max) {
          filter['services.price'] = {};
          if (price_min) filter['services.price'].$gte = Number(price_min);
          if (price_max) filter['services.price'].$lte = Number(price_max);
      }
      
      // Rating filter
      if (rating) {
          const ratingNum = Number(rating);
          filter['reviews.rating'] = { $gte: ratingNum };
      }
      
      // Location filter
      if (location) {
          const locationRegex = new RegExp(location, 'i');
          filter.$or = [
              { 'address.city': locationRegex },
              { 'address.state': locationRegex },
              { 'address.pincode': locationRegex }
          ];
      }
      
      // Service mode filter
      if (service_mode) {
          if (service_mode === 'home') {
              filter['serviceMode.homeService'] = true;
          } else if (service_mode === 'salon') {
              filter['serviceMode.inSalon'] = true;
          }
      }
      
      // Gender filter (assuming from services or description)
      if (gender) {
          const genderRegex = new RegExp(gender, 'i');
          filter.$or = [
              { name: genderRegex },
              { description: genderRegex },
              { 'services.serviceName': genderRegex }
          ];
      }

      // Availability filter
      const today = new Date();
      if (availability === 'today') {
          const dayOfWeek = today.getDay();
          filter['availability.dayOfWeek'] = dayOfWeek;
          filter['availability.isOpen'] = true;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Build sort options
      let sortOptions = {};
      switch (sort) {
          case 'price-low-high':
              sortOptions = { 'services.price': 1 };
              break;
          case 'price-high-low':
              sortOptions = { 'services.price': -1 };
              break;
          case 'top-rated':
              sortOptions = { 'reviews.rating': -1 };
              break;
          default:
              sortOptions = { createdAt: -1 };
      }

      // Get total count for pagination
      const totalSalons = await Salon.countDocuments(filter);

      // Fetch salons with pagination and sorting
      const salons = await Salon.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(Number(limit))
          .lean();

      // Enrich salon data
      const enrichedSalons = salons.map(salon => {
          // Calculate average rating
          const avgRating = salon.reviews && salon.reviews.length > 0
              ? salon.reviews.reduce((sum, review) => sum + review.rating, 0) / salon.reviews.length
              : 0;

          // Get unique services (first 4)
          const uniqueServices = [...new Set(salon.services?.map(s => s.serviceName) || [])].slice(0, 4);
          
          // Check if available today
          const dayOfWeek = today.getDay();
          const todayAvailability = salon.availability?.find(a => a.dayOfWeek === dayOfWeek);
          const isAvailableToday = todayAvailability?.isOpen || false;
          
          // Get lowest price
          const lowestPrice = salon.services?.length > 0
              ? Math.min(...salon.services.map(s => s.price))
              : 0;

          return {
              ...salon,
              avgRating: avgRating.toFixed(1),
              reviewCount: salon.reviews?.length || 0,
              serviceNames: uniqueServices,
              isAvailableToday,
              lowestPrice,
              locationText: `${salon.address?.city || ''}, ${salon.address?.state || ''}`.trim()
          };
      });

      // Get unique service names for filter options
      const allServices = await Salon.distinct('services.serviceName', { status: 'active' });
      const serviceCounts = {};
      for (const serviceName of allServices) {
          const count = await Salon.countDocuments({ 
              status: 'active',
              'services.serviceName': serviceName 
          });
          serviceCounts[serviceName] = count;
      }

      // Get unique locations for filter
      const locations = await Salon.aggregate([
          { $match: { status: 'active' } },
          { $group: {
              _id: '$address.city',
              count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 10 }
      ]);

      res.render('user/saloon-service', {
          title: 'Book a Salon',
          salons: enrichedSalons,
          currentPage: Number(page),
          totalPages: Math.ceil(totalSalons / limit),
          totalSalons,
          pageSize: limit,
          filters: {
              service: service || '',
              price_min: price_min || '',
              price_max: price_max || '',
              availability: availability || '',
              gender: gender || '',
              location: location || '',
              rating: rating || '',
              service_mode: service_mode || '',
              sort: sort || 'top-rated'
          },
          filterOptions: {
              services: Object.entries(serviceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => ({ name, count })),
              locations: locations.map(loc => ({ 
                  name: loc._id, 
                  count: loc.count 
              })),
              priceRanges: [
                  { min: 0, max: 500, label: 'Under ₹500' },
                  { min: 500, max: 1000, label: '₹500 - ₹1000' },
                  { min: 1000, max: 2000, label: '₹1000 - ₹2000' },
                  { min: 2000, max: 5000, label: '₹2000+' }
              ],
              ratings: [
                  { value: 4, label: '4★ & above' },
                  { value: 3, label: '3★ & above' }
              ],
              serviceModes: [
                  { value: 'salon', label: 'Salon Visit' },
                  { value: 'home', label: 'Home Service' }
              ],
              availabilities: [
                  { value: 'today', label: 'Available Today' },
                  { value: 'weekend', label: 'Weekend Slots' }
              ]
          }
      });

  } catch (error) {
      console.error('Error fetching salons:', error);
      res.status(500).render('error', { 
          message: 'Failed to load salons. Please try again.' 
      });
  }
});

// Salon details route
router.get('/book-a-saloon/:id', async (req, res) => {
  try {
      const salon = await Salon.findById(req.params.id).lean();
      
      if (!salon) {
          return res.status(404).json({ 
              success: false,
              message: 'Salon not found' 
          });
      }

      // Calculate average rating
      const avgRating = salon.reviews && salon.reviews.length > 0
          ? salon.reviews.reduce((sum, review) => sum + review.rating, 0) / salon.reviews.length
          : 0;

      // Group services by category
      const servicesByCategory = salon.services?.reduce((acc, service) => {
          const category = service.serviceName.split(' ')[0]; // Simple categorization
          if (!acc[category]) acc[category] = [];
          acc[category].push(service);
          return acc;
      }, {});

      res.json({
          success: true,
          salon: {
              ...salon,
              avgRating: avgRating.toFixed(1),
              reviewCount: salon.reviews?.length || 0,
              servicesByCategory,
              locationText: `${salon.address?.line1 || ''}, ${salon.address?.city || ''}, ${salon.address?.state || ''}`
          }
      });
  } catch (error) {
      console.error('Error fetching salon details:', error);
      res.status(500).json({ 
          success: false,
          message: 'Failed to load salon details' 
      });
  }
});

// API endpoint for AJAX filtering
router.get('/api/salons', async (req, res) => {
  try {
      const { 
          page = 1, 
          limit = 6, 
          ...filters 
      } = req.query;

      // Build filter query (same as above)
      let filter = { status: 'active' };
      
      if (filters.service) {
          filter['services.serviceName'] = { 
              $regex: filters.service, 
              $options: 'i' 
          };
      }
      
      if (filters.price_min || filters.price_max) {
          filter['services.price'] = {};
          if (filters.price_min) filter['services.price'].$gte = Number(filters.price_min);
          if (filters.price_max) filter['services.price'].$lte = Number(filters.price_max);
      }
      
      if (filters.rating) {
          filter['reviews.rating'] = { $gte: Number(filters.rating) };
      }
      
      if (filters.location) {
          const locationRegex = new RegExp(filters.location, 'i');
          filter.$or = [
              { 'address.city': locationRegex },
              { 'address.state': locationRegex },
              { 'address.pincode': locationRegex }
          ];
      }

      const skip = (page - 1) * limit;
      const totalSalons = await Salon.countDocuments(filter);

      const salons = await Salon.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean();

      // Enrich data
      const enrichedSalons = salons.map(salon => {
          const avgRating = salon.reviews && salon.reviews.length > 0
              ? salon.reviews.reduce((sum, review) => sum + review.rating, 0) / salon.reviews.length
              : 0;

          return {
              _id: salon._id,
              name: salon.name,
              images: salon.images,
              description: salon.description,
              avgRating: avgRating.toFixed(1),
              reviewCount: salon.reviews?.length || 0,
              services: salon.services?.slice(0, 4).map(s => s.serviceName) || [],
              address: salon.address,
              lowestPrice: salon.services?.length > 0
                  ? Math.min(...salon.services.map(s => s.price))
                  : 0,
              isAvailableToday: true // Simplified for now
          };
      });

      res.json({
          success: true,
          salons: enrichedSalons,
          pagination: {
              currentPage: Number(page),
              totalPages: Math.ceil(totalSalons / limit),
              totalSalons
          }
      });
  } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch salons' 
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
