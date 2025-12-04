
const express = require("express");
const router = express.Router();

const upload = require("../middlewares/upload");
const categoryCtrl = require('../controllers/categoryControllers')
const productCtrl = require('../controllers/productCtrl');
const beautyTipCtrl = require('../controllers/beautyTipController');
const ChildCategory = require("../models/ChildCategory");
const SubCategory = require("../models/SubCategory");
const blogCtrl = require("../controllers/blogController");
const testimonialsCtrl = require('../controllers/testimonials');
const bannerCtrl = require('../controllers/bannerController');




router.post("/category/create", upload.single("image"), categoryCtrl.createCategory);
router.put("/category/update/:id", upload.single("image"), categoryCtrl.updateCategory);
router.patch("/category/toggle/:id", categoryCtrl.toggleCategoryStatus);
router.delete("/category/delete/:id", categoryCtrl.deleteCategory);


router.post("/subcategory/create", upload.single("image"), categoryCtrl.createSubCategory);
router.put("/subcategory/update/:id", upload.single("image"), categoryCtrl.updateSubCategory);
router.patch("/subcategory/toggle/:id", categoryCtrl.toggleSubCategoryStatus);
router.delete("/subcategory/delete/:id", categoryCtrl.deleteSubCategory);


router.post("/childcategory/create", upload.single("image"), categoryCtrl.createChildCategory);
router.put("/childcategory/update/:id", upload.single("image"), categoryCtrl.updateChildCategory);
router.patch("/childcategory/toggle/:id", categoryCtrl.toggleChildCategoryStatus);
router.delete("/childcategory/delete/:id", categoryCtrl.deleteChildCategory);



// CREATE PRODUCT
router.post(
  "/createProduct",
  upload.any(),
  productCtrl.createProduct
);

  
router.put(
  "/updateProduct/:id/update",
  upload.any(),
  productCtrl.updateProduct
);

// Get product details for admin edit
router.get("/admin/products/product/:id", async (req, res) => {
  try {
    const product = await productCtrl.getProductById
      ? await productCtrl.getProductById(req, res)
      : await require("../models/Product").findById(req.params.id)
          .populate("category subCategory childCategory beautyTips")
          .lean();

    // If productCtrl.getProductById sends a response, stop here
    if (res.headersSent) return;

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


  
  // TOGGLE STATUS
  router.patch("/product/:id/toggle-status", productCtrl.toggleProductStatus);
  
  // DELETE PRODUCT
  router.delete("/product/:id/delete", productCtrl.deleteProduct);


// List all Beauty Tips
router.get(
  "/beautytips",
  beautyTipCtrl.listBeautyTips
);

// CREATE Beauty Tip
router.post(
  "/beautytip/create",
  upload.single("image"),
  beautyTipCtrl.createBeautyTip
);

// UPDATE Beauty Tip
router.put(
  "/beautytip/update/:id",
  upload.single("image"),
  beautyTipCtrl.updateBeautyTip
);

// DELETE Beauty Tip
router.delete(
  "/beautytip/delete/:id",
  beautyTipCtrl.deleteBeautyTip
);

// UPDATE STATUS of Beauty Tip
router.patch(
  "/beautytip/:id/toggle-status",
  beautyTipCtrl.toggleBeautyTipStatus
);

router.get('/api/subcategories', async (req, res) => {
  try {
      const { categoryId } = req.query;
      const query = categoryId ? { categoryId: categoryId, status: { $ne: 'deleted' } } : { status: { $ne: 'deleted' } };
      
      const subcategories = await SubCategory.find(query).lean();
      res.json(subcategories);
  } catch (error) {
      console.error('Error fetching subcategories:', error);
      res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

router.get('/api/childcategories', async (req, res) => {
  try {
      const { subcategoryId } = req.query;
      const query = subcategoryId ? { subCategoryId: subcategoryId, status: { $ne: 'deleted' } } : { status: { $ne: 'deleted' } };
      
      const childcategories = await ChildCategory.find(query).lean();
      res.json(childcategories);
  } catch (error) {
      console.error('Error fetching child categories:', error);
      res.status(500).json({ error: 'Failed to fetch child categories' });
  }
});

// CREATE BLOG
router.post(
  "/blog/create",
  upload.fields([
    { name: "image", maxCount: 1 }
  ]),
  blogCtrl.createBlog
);

// UPDATE BLOG
router.put(
  "/blog/update/:id",
  upload.fields([
    { name: "image", maxCount: 1 }
  ]),
  blogCtrl.updateBlog
);

// LIST ALL BLOGS
router.get("/blogs", blogCtrl.getAllBlogs);

// GET SINGLE BLOG BY SLUG
router.get("/blog/:slug", blogCtrl.getBlogBySlug);

// DELETE BLOG
router.delete("/blog/delete/:id", blogCtrl.deleteBlog);

// Create a testimonial
router.post('/testimonials', testimonialsCtrl.createTestimonial);

// Edit a testimonial
router.put('/testimonials/:id', testimonialsCtrl.editTestimonial);

// List all testimonials
router.get('/testimonials', testimonialsCtrl.listTestimonials);

// Delete a testimonial
router.delete('/testimonials/:id', testimonialsCtrl.deleteTestimonial);

router.get("/bannerlist", bannerCtrl.bannerList);
router.post("/bannercreate", upload.single("image"), bannerCtrl.bannerCreate);
router.post("/banner/:id/update", upload.single("image"), bannerCtrl.bannerUpdate);
router.post("/banner/:id/toggle", bannerCtrl.bannerToggleActive);
router.delete("/bannerdelete/:id", bannerCtrl.bannerDelete);

router.get("/posterList", bannerCtrl.posterList);
router.post("/postercreate", upload.single("image"), bannerCtrl.posterCreate);
router.post("/poster/:id/update", upload.single("image"), bannerCtrl.posterUpdate);
router.post("/poster/:id/toggle", bannerCtrl.posterToggleActive);
router.delete("/posterdelete/:id", bannerCtrl.posterDelete);

router.get('/api/search/init', productCtrl.searchInit);
router.get('/api/search/live', productCtrl.searchLive);


module.exports = router;