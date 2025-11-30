const express = require('express');
const router = express.Router();
const resellerCtrl = require('../controllers/resellerController');
const { isLoggedIn, isRole,isAdmin } = require('../middlewares/auth');
const upload = require("../middlewares/upload");
const Reseller = require('../models/Reseller');
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const ChildCategory = require("../models/ChildCategory");
const BeautyTip = require('../models/BeautyTip');

router.get('/reseller_register', resellerCtrl.registerPage);
router.post(
  '/register', 
  upload.fields([
    { name: "documents", maxCount: 10 }
  ]), 
  resellerCtrl.registerReseller
);


router.get(
  '/reseller_dashboard',
  isLoggedIn,
  isRole('reseller'),
  async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;

    const filter = { };
    if (req.session.user && req.session.user.resellerId) {
      filter._id = req.session.user.resellerId;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [resellers, totalResellers, categories, subCategories, childCategories, beautyTips] = await Promise.all([
        Reseller.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Reseller.countDocuments(filter),
        Category.find({ isActive: true }).lean(),
        SubCategory.find({ isActive: true }).lean(),
        ChildCategory.find({ isActive: true }).lean(),
        BeautyTip.find({ status: "published" }).lean() // Add beauty tips
      ]);

      // Build nested category structure
      const categoriesWithHierarchy = categories.map(category => {
        const categoryObj = category.toObject ? category.toObject() : { ...category };
        
        // Add subcategories to category
        categoryObj.subcategories = subCategories
          .filter(sub => sub.categoryId && sub.categoryId.toString() === category._id.toString())
          .map(sub => {
            const subObj = sub.toObject ? sub.toObject() : { ...sub };
            
        
            subObj.childcategories = childCategories
              .filter(child => 
                child.subCategoryId && child.subCategoryId.toString() === sub._id.toString() &&
                child.categoryId && child.categoryId.toString() === category._id.toString()
              );
            
            return subObj;
          });
        
        return categoryObj;
      });

      res.render('reseller/reseller_dashboard', {
        resellers,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResellers / parseInt(limit)),
        totalResellers,
        filters: { status, search },
        categories: categoriesWithHierarchy, 
        subCategories,
        childCategories,
        beautyTips 
      });
    } catch (err) {
      console.error('Error loading reseller dashboard:', err);
      res.status(500).render('error', { message: 'Failed to load reseller dashboard' });
    }
  }
);
router.post("/send-login-otp", resellerCtrl.sendLoginOtp);
router.post("/verify-login-otp", resellerCtrl.verifyLoginOtp);

router.patch('/approve/:resellerId', isAdmin, resellerCtrl.approveReseller);

// LIST RESLLER PRODUCTS
router.get("/products", isLoggedIn, isRole("reseller"), resellerCtrl.listProducts);

// CREATE PRODUCT
router.post(
  "/products/create",
  isLoggedIn,
  isRole("reseller"),
  upload.any(),
  resellerCtrl.createProduct
);

// EDIT PRODUCT
router.post(
  "/products/edit/:id",
  isLoggedIn,
  isRole("reseller"),
  upload.any(),
  resellerCtrl.updateProduct
);


// Route to get product data for editing
router.get(
  "/products/:id/one",
  isLoggedIn,
  isRole("reseller"),
  resellerCtrl.getProductOne
);


// TOGGLE STATUS
router.patch(
  "/products/toggle/:id",
  isLoggedIn,
  isRole("reseller"),
  resellerCtrl.toggleProductStatus
);

// DELETE PRODUCT
router.delete(
  "/products/delete/:id",
  isLoggedIn,
  isRole("reseller"),
  resellerCtrl.deleteProduct
);

module.exports = router;