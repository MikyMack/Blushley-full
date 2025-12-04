const Product = require("../models/Product");
const { uploadBuffer } = require("../config/s3");
const slugify = require("slugify");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const ChildCategory = require("../models/ChildCategory");

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
      seo
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

        optionsArray.push({
          value: option.value,
          stock: Number(option.stock || 0),
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
    
    const product = await Product.create({
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

      status: req.body.status || "pending"
    });

    res.json({ success: true, product });

  } catch (err) {
    console.error("Create Product Error:", err);
    res.status(500).json({ error: err.message });
  }
};



// ---------------- UPDATE PRODUCT (FULLY FIXED) ----------------

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
      status
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

        optionsArray.push({
          value: option.value,
          stock: Number(option.stock || 0),
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

    // Only include non-empty category, subCategory, and childCategory in update
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
      }
    };

    
    if (category && typeof category === "string" && category.trim() !== "") updateObj.category = category;
    if (subCategory !== undefined) updateObj.subCategory = subCategory;
    if (childCategory !== undefined) updateObj.childCategory = childCategory;
    if (status) updateObj.status = status;

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
