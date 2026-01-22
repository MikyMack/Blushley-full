const Product = require("../models/Product");
const { uploadBuffer } = require("../config/s3");
const slugify = require("slugify");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const ChildCategory = require("../models/ChildCategory");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const Wishlist = require('../models/Wishlist');
const Cart = require('../models/Cart');

function safeParse(value, fallback = null) {
  try {
    if (!value) return fallback;
    if (typeof value === "string") return JSON.parse(value);
    if (typeof value === "object") return value;
    return fallback;
  } catch {
    return fallback;
  }
}


exports.createProduct = async (req, res) => {
  try {
    let {
      title,
      description,
      shortDescription,
      category,
      subCategory,
      childCategory,
      brand,
      basePrice,
      salePrice,
      adminBasePrice,
      adminSalePrice,
      variants,
      tags,
      ingredients,
      benefits,
      howToUse,
      weight,
      dimensions,
      beautyTips,
      seo,
      totalStock,
      productType, 
      ownerRef
    } = req.body;

    if (!title || !basePrice) {
      return res.status(400).json({ error: "Title and Base price required" });
    }

    const slug = title.toLowerCase().replace(/\s+/g, "-");

    const mainImages = req.files.filter(f => f.fieldname === "images");

    let images = [];
    for (const file of mainImages) {
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "products/",
        contentType: file.mimetype
      });
      images.push(uploaded.location);
    }

    const parsedVariants = safeParse(variants, {});
    const parsedDimensions = safeParse(dimensions, {});
    const parsedSeo = safeParse(seo, {});
    const parsedBeautyTips = safeParse(beautyTips, []);

    const variantFiles = req.files.filter(f =>
      f.fieldname.startsWith("variantFile__")
    );

    const variantFileMap = {};

    variantFiles.forEach(file => {
      const parts = file.fieldname.split("__");
      const variantId = parts[1];
      const optionId = parts[2];
      if (!variantFileMap[variantId]) variantFileMap[variantId] = {};
      if (!variantFileMap[variantId][optionId]) variantFileMap[variantId][optionId] = [];
      variantFileMap[variantId][optionId].push(file);
    });

    let finalVariants = [];
    let computedTotalStock = 0;

    for (let vKey in parsedVariants) {
      const variant = parsedVariants[vKey];
      const optionsArray = [];
      for (let optKey in variant.options) {
        const option = variant.options[optKey];

        // Upload files for THIS option
        const files = variantFileMap[vKey]?.[optKey] || [];

        let uploadedImages = [];
        for (const file of files) {
          const uploaded = await uploadBuffer(file.buffer, {
            KeyPrefix: "products/variants/",
            contentType: file.mimetype
          });
          uploadedImages.push(uploaded.location);
        }

        let optionStock = Number(option.stock || 0);
        computedTotalStock += optionStock;

        optionsArray.push({
          value: option.value,
          stock: optionStock,
          sku: option.sku,
          price: Number(option.price || 0),
          adminBasePrice: Number(option.adminBasePrice || 0),
          adminSalePrice: Number(option.adminSalePrice || 0),
          images: uploadedImages
        });
      }

      finalVariants.push({
        name: variant.name,
        options: optionsArray
      });
    }

    category = category?.trim() ? category : undefined;
    subCategory = subCategory?.trim() ? subCategory : undefined;
    childCategory = childCategory?.trim() ? childCategory : undefined;

    // Calculate totalStock: if variants exist, use sum of stocks, else use provided value
    let savedTotalStock = 0;
    if (finalVariants && finalVariants.length > 0) {
      savedTotalStock = computedTotalStock;
    } else {
      // This is the simple product (no variants: take plain input or 0)
      const tsString = typeof totalStock !== "undefined"
        ? totalStock
        : req.body.totalStock;
      savedTotalStock = Number(tsString || 0);
    }

    // productType defaults to "admin" if not specified or invalid
    let safeProductType = "admin";
    if (typeof productType === "string" && ["admin", "salon", "reseller"].includes(productType)) {
      safeProductType = productType;
    }
    // ownerRef should be a string or ObjectId value if provided
    let safeOwnerRef = undefined;
    if (ownerRef && typeof ownerRef === "string" && ownerRef.trim() !== "") {
      safeOwnerRef = ownerRef;
    }

    const productData = {
      title,
      slug,
      description,
      shortDescription,
      category,
      subCategory,
      childCategory,
      brand,

      beautyTips: parsedBeautyTips,

      basePrice: Number(basePrice),
      salePrice: Number(salePrice || 0),
      adminBasePrice: Number(adminBasePrice || 0),
      adminSalePrice: Number(adminSalePrice || 0),

      variants: finalVariants,
      images,

      tags: safeParse(tags, []),
      ingredients: safeParse(ingredients, []),
      benefits: safeParse(benefits, []),

      howToUse,
      weight: Number(weight),

      dimensions: parsedDimensions,

      seo: {
        title: parsedSeo.title,
        description: parsedSeo.description,
        keywords: safeParse(parsedSeo.keywords, [])
      },

      totalStock: savedTotalStock,

      status: req.body.status || "pending",
      productType: safeProductType
    };

    if (safeOwnerRef) productData.ownerRef = safeOwnerRef;

    const product = await Product.create(productData);

    res.json({ success: true, product });

  } catch (err) {
    console.error("Create Product Error:", err);
    res.status(500).json({ error: err.message });
  }
};


exports.updateProduct = async (req, res) => {

  try {
    const productId = req.params.id;

    let {
      title,
      description,
      shortDescription,
      category,
      subCategory,
      childCategory,
      brand,
      basePrice,
      salePrice,
      adminBasePrice,
      adminSalePrice,
      variants,
      tags,
      ingredients,
      benefits,
      howToUse,
      weight,
      dimensions,
      beautyTips,
      seo,
      status,
      totalStock,
      productType, // allow updating productType
      ownerRef     // allow updating ownerRef
    } = req.body;

    category = (category && typeof category === "string" && category.trim() !== "")
      ? category
      : undefined;

    subCategory = (subCategory && typeof subCategory === "string" && subCategory.trim() !== "")
      ? subCategory
      : undefined;

    childCategory = (childCategory && typeof childCategory === "string" && childCategory.trim() !== "")
      ? childCategory
      : undefined;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let updatedImages = Array.isArray(product.images) ? [...product.images] : [];

    const mainImages = req.files.filter(f => f.fieldname === "images");

    for (const file of mainImages) {
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "products/",
        contentType: file.mimetype
      });
      updatedImages.push(uploaded.location);
    }

    const parsedVariants = safeParse(variants, {});
    const parsedDimensions = safeParse(dimensions, {});
    const parsedSeo = safeParse(seo, {});
    const parsedBeautyTips = safeParse(beautyTips, []);
    const safeTags = safeParse(tags, []);
    const safeIngredients = safeParse(ingredients, []);
    const safeBenefits = safeParse(benefits, []);

    const variantFiles = req.files.filter(f =>
      f.fieldname.startsWith("variantFile__")
    );

    const variantFileMap = {};

    variantFiles.forEach(file => {
      const parts = file.fieldname.split("__");
      const variantId = parts[1];
      const optionId = parts[2];

      if (!variantFileMap[variantId]) variantFileMap[variantId] = {};
      if (!variantFileMap[variantId][optionId]) variantFileMap[variantId][optionId] = [];

      variantFileMap[variantId][optionId].push(file);
    });

    let finalVariants = [];
    let computedTotalStock = 0;

    for (let vKey in parsedVariants) {
      const variant = parsedVariants[vKey];
      const optionsArray = [];
      for (let optKey in variant.options) {
        const option = variant.options[optKey];

        let existingImages = [];
        try {
          existingImages = safeParse(option.existingImages, []);
        } catch (err) {
          existingImages = [];
        }

        const files = variantFileMap[vKey]?.[optKey] || [];

        let newImages = [];

        for (const file of files) {
          const uploaded = await uploadBuffer(file.buffer, {
            KeyPrefix: "products/variants/",
            contentType: file.mimetype
          });
          newImages.push(uploaded.location);
        }

        let optionStock = Number(option.stock || 0);
        computedTotalStock += optionStock;

        optionsArray.push({
          value: option.value,
          stock: optionStock,
          sku: option.sku,
          price: Number(option.price || 0),
          adminBasePrice: Number(option.adminBasePrice || 0),
          adminSalePrice: Number(option.adminSalePrice || 0),
          images: [...existingImages, ...newImages]
        });
      }

      finalVariants.push({
        name: variant.name,
        options: optionsArray
      });
    }

    // Calculate updatedTotalStock: if variants, sum their stocks
    let updatedTotalStock = 0;
    if (finalVariants && finalVariants.length > 0) {
      updatedTotalStock = computedTotalStock;
    } else {
      const tsString = typeof totalStock !== "undefined"
        ? totalStock
        : req.body.totalStock;
      updatedTotalStock = Number(tsString || 0);
    }

    // productType from body, fallback to old value, default to "admin"
    let safeProductType = (typeof productType === "string" &&
      ["admin", "salon", "reseller"].includes(productType))
      ? productType
      : (product.productType || "admin");

    // ownerRef from body, fallback to previous, or undefined if missing
    let safeOwnerRef = undefined;
    if (ownerRef && typeof ownerRef === "string" && ownerRef.trim() !== "") {
      safeOwnerRef = ownerRef;
    } else if (product.ownerRef) {
      safeOwnerRef = product.ownerRef;
    }

    const updateObj = {
      title: title || product.title,
      slug: title
        ? title.toLowerCase().replace(/\s+/g, "-")
        : product.slug,

      description,
      shortDescription,
      brand,

      beautyTips: parsedBeautyTips,

      basePrice: Number(basePrice),
      salePrice: Number(salePrice || 0),
      adminBasePrice: Number(adminBasePrice || 0),
      adminSalePrice: Number(adminSalePrice || 0),

      variants: finalVariants,
      images: updatedImages,

      tags: safeTags,
      ingredients: safeIngredients,
      benefits: safeBenefits,

      howToUse,
      weight: Number(weight),

      dimensions: parsedDimensions,

      seo: {
        title: parsedSeo.title,
        description: parsedSeo.description,
        keywords: safeParse(parsedSeo.keywords, [])
      },

      totalStock: updatedTotalStock,
      productType: safeProductType
    };

    if (category && typeof category === "string" && category.trim() !== "") updateObj.category = category;
    if (subCategory !== undefined) updateObj.subCategory = subCategory;
    if (childCategory !== undefined) updateObj.childCategory = childCategory;
    if (status) updateObj.status = status;
    if (safeOwnerRef) updateObj.ownerRef = safeOwnerRef;

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateObj,
      { new: true, runValidators: true }
    );

    return res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });

  } catch (err) {
    console.error("Update Product Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ---------------- TOGGLE PRODUCT STATUS ----------------
exports.toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ error: "Product not found" });

    product.status = product.status === "approved" ? "disabled" : "approved";
    await product.save();

    res.json({ success: true, status: product.status });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ---------------- DELETE PRODUCT ----------------
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json({ success: true, message: "Product deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.searchInit = async (req, res) => {
  try {
 
    const [categories, subcategories, childcategories] = await Promise.all([
      Category.find({ isActive: true }).select('name slug').limit(100).lean(),
      SubCategory.find({ isActive: true }).select('name slug').limit(200).lean(),
      ChildCategory.find({ isActive: true }).select('name slug').limit(200).lean()
    ]);


    const brands = await Product.distinct('brand', { brand: { $exists: true, $ne: '' } });


    let recentlyViewed = [];
    try {
      const raw = req.cookies && req.cookies.recentlyViewedV1;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {

          const ids = parsed.filter(p => p && p._id).map(p => p._id);
          if (ids.length) {
            const prods = await Product.find({ _id: { $in: ids } })
              .select('title slug images')
              .lean();
     
            recentlyViewed = ids.map(id => prods.find(p => p._id.toString() === id.toString())).filter(Boolean);
          } else {
       
            recentlyViewed = parsed.slice(0,12).map(p => ({
              _id: p._id,
              slug: p.slug,
              title: p.title,
              images: p.images || []
            }));
          }
        }
      }
    } catch (e) {
      recentlyViewed = [];
    }

    return res.json({ success: true, categories, subcategories, childcategories, brands, recentlyViewed });
  } catch (err) {
    console.error('SEARCH INIT ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.searchLive = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const catParam = (req.query.category || "").trim();
    const brandParam = (req.query.brand || "").trim();

    if (!q || q.length < 3) {
      return res.json({
        success: true,
        products: [],
        categories: [],
        subcategories: [],
        childcategories: [],
      });
    }

    const regex = new RegExp(
      q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

  
    const productQuery = {
      status: "approved",
      $or: [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { tags: { $regex: regex } },
        { brand: { $regex: regex } },
      ],
    };

    if (catParam) {
      const cats = catParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (cats.length) {
        productQuery.category = { $in: cats };
      }
    }

    if (brandParam) {
      const brands = brandParam.split(",").map((b) => b.trim()).filter(Boolean);
      if (brands.length) {
        productQuery.brand = { $in: brands.map((b) => new RegExp("^" + b + "$", "i")) };
      }
    }

    const products = await Product.find(productQuery)
      .select("title slug images salePrice basePrice brand")
      .limit(30)
      .lean();


    const [categories, subcategories, childcategories] = await Promise.all([
      Category.find({ name: { $regex: regex }, isActive: true }).limit(10).select("name slug").lean(),
      SubCategory.find({ name: { $regex: regex }, isActive: true }).limit(10).select("name slug").lean(),
      ChildCategory.find({ name: { $regex: regex }, isActive: true }).limit(10).select("name slug").lean(),
    ]);

    return res.json({
      success: true,
      products,
      categories,
      subcategories,
      childcategories,
    });

  } catch (err) {
    console.error("SEARCH LIVE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.addReview = async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, rating, content } = req.body;
    const userId = req.session?.user?.id; // Session-based user

    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    if (!rating) {
      return res.status(400).json({ success: false, message: "Rating is required" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // Check if user already reviewed
    const existingReview = product.reviews.find(r => r.userId?.toString() === userId);

    if (existingReview) {
      // Update previous review
      existingReview.rating = rating;
      existingReview.content = content;
      existingReview.name = name || existingReview.name;
    } else {
      // Add new review
      product.reviews.push({
        userId,
        name,
        rating,
        content
      });
    }

    // Recalculate rating + totalReviews
    product.totalReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.totalReviews;

    await product.save();

    return res.json({
      success: true,
      message: "Review submitted successfully",
      product
    });

  } catch (err) {
    console.error("ADD REVIEW ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    // Find the review
    const review = product.reviews.id(reviewId);

    if (!review)
      return res.status(404).json({ success: false, message: "Review not found" });

    // Prevent others from deleting
    if (review.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Remove review
    review.deleteOne();

    // Recalculate rating
    product.totalReviews = product.reviews.length;
    product.rating = product.totalReviews === 0
      ? 0
      : product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.totalReviews;

    await product.save();

    return res.json({
      success: true,
      message: "Review deleted",
      product
    });

  } catch (err) {
    console.error("DELETE REVIEW ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      discountValue,
      appliesTo,
      categories,
      products,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      perUserLimit
    } = req.body;

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      type,
      discountValue,
      appliesTo,
      categories: categories || [],
      products: products || [],
      minPurchase: Number(minPurchase || 0),
      maxDiscount: Number(maxDiscount || 0),
      startDate,
      endDate,
      usageLimit,
      perUserLimit
    });

    return res.json({ success: true, coupon });
  } catch (err) {
    console.error("CREATE COUPON ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const updated = await Coupon.findByIdAndUpdate(
      couponId,
      { ...req.body },
      { new: true }
    );

    return res.json({ success: true, coupon: updated });
  } catch (err) {
    console.error("UPDATE COUPON ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Coupon deleted" });
  } catch (err) {
    console.error("DELETE COUPON ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.json({ success: true, coupons });
  } catch (err) {
    console.error("LIST COUPONS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCouponCategories = async (req, res) => {
  const categories = await Category.find({}).select("_id name");
  res.json({ success: true, categories });
};

exports.searchProducts = async (req, res) => {
  try {
    const { q = "", page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const filter = q
      ? { title: { $regex: q, $options: "i" } }
      : {};

    const products = await Product.find(filter)
      .select("_id title")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    return res.json({
      success: true,
      products,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error("PRODUCT SEARCH ERROR:", err);
    res.status(500).json({ success: false });
  }
};

// Add to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId, variantName, optionValue, optionId } = req.body;
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Find or create wishlist for user
    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({ 
        userId, 
        items: [] 
      });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      item => item.productId.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product already in wishlist' 
      });
    }

    // Add new item
    wishlist.items.push({
      productId,
      variantName,
      optionValue,
      optionId
    });

    await wishlist.save();

    res.json({ 
      success: true, 
      message: 'Added to wishlist',
      wishlist 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }
    const wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wishlist not found' 
      });
    }

    // Remove item from wishlist
    wishlist.items = wishlist.items.filter(
      item => item.productId.toString() !== productId
    );

    await wishlist.save();

    res.json({ 
      success: true, 
      message: 'Removed from wishlist',
      wishlist 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get user wishlist with product details
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'items.productId',
        select: 'title images basePrice salePrice totalStock variants status slug',
        match: { 
          status: { $in: ['approved'] } // Only show approved products
        }
      });

    if (!wishlist) {
      return res.json({ 
        success: true, 
        wishlist: { items: [] } 
      });
    }

    const validItems = wishlist.items.filter(item => item.productId);

    res.json({ 
      success: true, 
      wishlist: {
        ...wishlist.toObject(),
        items: validItems
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Move from wishlist to cart
exports.moveToCart = async (req, res) => {
  try {
    const { productId, variantName, optionValue, optionId, quantity = 1 } = req.body;
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }
    // Get product with details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check product status
    if (product.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Product is not available for purchase' 
      });
    }

    // Check stock availability
    let stockAvailable = false;
    let selectedPrice = product.salePrice || product.basePrice;
    let selectedVariantOption = null;

    // If product has variants
    if (product.variants && product.variants.length > 0) {
      if (!variantName || !optionValue) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please select a variant' 
        });
      }

      // Find the specific variant option
      for (const variant of product.variants) {
        if (variant.name === variantName) {
          const option = variant.options.find(opt => opt.value === optionValue);
          if (option) {
            selectedVariantOption = option;
            stockAvailable = option.stock > 0;
            selectedPrice = option.price || product.basePrice;
            break;
          }
        }
      }

      if (!selectedVariantOption) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected variant not found' 
        });
      }
    } else {
      // Simple product without variants
      stockAvailable = product.totalStock > 0;
    }

    if (!stockAvailable) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product is out of stock' 
      });
    }

    // Check if item already in cart
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      cart = new Cart({ 
        userId, 
        items: [] 
      });
    }

    // Check if same product with same variant already in cart
    const existingCartItem = cart.items.find(item => {
      if (item.productId.toString() !== productId) return false;
      
      if (product.variants && product.variants.length > 0) {
        return item.variantName === variantName && 
               item.optionValue === optionValue;
      }
      return true;
    });

    if (existingCartItem) {
      // Update quantity if already in cart
      existingCartItem.quantity += quantity;
    } else {
      // Add new item to cart
      cart.items.push({
        productId,
        variantName,
        optionValue,
        optionId,
        quantity,
        price: selectedPrice
      });
    }

    await cart.save();

    // Remove from wishlist after adding to cart
    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      wishlist.items = wishlist.items.filter(
        item => item.productId.toString() !== productId
      );
      await wishlist.save();
    }

    res.json({ 
      success: true, 
      message: 'Added to cart',
      cart,
      removedFromWishlist: true
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


exports.checkWishlistStock = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items.productId",
      select: "title totalStock variants status",
    });

    if (!wishlist || wishlist.items.length === 0) {
      return res.json({ success: true, items: [] });
    }

    const itemsWithStock = wishlist.items.map((item) => {
      const product = item.productId;
      let inStock = false;
      let stockInfo = null;

      if (!product) {
        return {
          productId: item.productId,
          inStock: false,
          message: "Product not found",
        };
      }

      if (product.status !== "approved") {
        return {
          productId: product._id,
          inStock: false,
          message: "Product not available",
        };
      }

      if (product.variants && product.variants.length > 0) {
        const variant = product.variants.find((v) => v.name === item.variantName);

        if (variant) {
          const option = variant.options?.find((opt) => opt.value === item.optionValue);

          if (option) {
            inStock = option.stock > 0;
            stockInfo = {
              stock: option.stock,
              variantName: variant.name,
              optionValue: option.value,
            };
          } else {
            stockInfo = { stock: 0, message: "Option not found" };
          }
        } else {
          stockInfo = { stock: 0, message: "Variant not found" };
        }
      } else {
        inStock = product.totalStock > 0;
        stockInfo = { stock: product.totalStock };
      }

      return {
        productId: product._id,
        productName: product.title,
        inStock,
        stockInfo,
        variantName: item.variantName,
        optionValue: item.optionValue,
      };
    });

    return res.json({ success: true, items: itemsWithStock });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

