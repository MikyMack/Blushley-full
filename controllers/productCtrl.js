const Product = require("../models/Product");
const { uploadBuffer } = require("../config/s3");
const slugify = require("slugify");

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


// ---------------- CREATE PRODUCT ----------------
exports.createProduct = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files.map(f => f.fieldname));

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

    // ✅ MAIN IMAGES
    const mainImages = req.files.filter(f => f.fieldname === "images");

    let images = [];
    for (const file of mainImages) {
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "products/",
        contentType: file.mimetype
      });
      images.push(uploaded.location);
    }

    // ✅ SAFE PARSE EVERYTHING
    const parsedVariants = safeParse(variants, {});
    const parsedDimensions = safeParse(dimensions, {});
    const parsedSeo = safeParse(seo, {});
    const parsedBeautyTips = safeParse(beautyTips, []);

    // ✅ CONVERT VARIANT OBJECT → ARRAY
    let finalVariants = [];

    if (parsedVariants && typeof parsedVariants === "object") {
      for (let key in parsedVariants) {
        const variant = parsedVariants[key];

        const optionsArray = [];

        if (variant.options && typeof variant.options === "object") {
          for (let optKey in variant.options) {
            const option = variant.options[optKey];

            optionsArray.push({
              value: option.value,
              stock: Number(option.stock || 0),
              sku: option.sku,
              price: Number(option.price || 0),
              adminBasePrice: Number(option.adminBasePrice || 0),
              adminSalePrice: Number(option.adminSalePrice || 0),
              images: []   // images will be filled below
            });
          }
        }

        finalVariants.push({
          name: variant.name,
          options: optionsArray
        });
      }
    }

    // ✅ MAP VARIANT IMAGES
    const variantFiles = req.files.filter(f =>
      f.fieldname.startsWith("variants[")
    );

    let variantFileIndex = 0;

    for (let v of finalVariants) {
      for (let opt of v.options) {
        const uploadedImages = [];

        // Match however many images frontend wanted
        const imagesCount = Number(opt._imageCount || 0);

        for (let i = 0; i < imagesCount; i++) {
          const file = variantFiles[variantFileIndex++];

          if (file) {
            const uploaded = await uploadBuffer(file.buffer, {
              KeyPrefix: "products/variants/",
              contentType: file.mimetype
            });

            uploadedImages.push(uploaded.location);
          }
        }

        opt.images = uploadedImages;
      }
    }

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


// ---------------- UPDATE PRODUCT ----------------
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    console.log("UPDATE BODY:", req.body);
    console.log("UPDATE FILES:", req.files.map(f => f.fieldname));

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

    /* ---------------- MAIN IMAGES ---------------- */
    const newMainImages = req.files.filter(f => f.fieldname === "images");

    for (const file of newMainImages) {
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "products/",
        contentType: file.mimetype
      });

      product.images.push(uploaded.location); // Append new ones
    }

    /* ---------------- PARSE FORM DATA ---------------- */

    const parsedVariants = safeParse(variants, {});
    const parsedDimensions = safeParse(dimensions, {});
    const parsedSeo = safeParse(seo, {});
    const parsedBeautyTips = safeParse(beautyTips, []);

    /* ---------------- REBUILD VARIANTS ---------------- */

    let finalVariants = [];

    if (parsedVariants && typeof parsedVariants === "object") {
      for (let vKey in parsedVariants) {
        const variant = parsedVariants[vKey];
        const optionsArray = [];

        if (variant.options && typeof variant.options === "object") {

          for (let optKey in variant.options) {
            const option = variant.options[optKey];

            optionsArray.push({
              value: option.value,
              stock: Number(option.stock || 0),
              sku: option.sku,
              price: Number(option.price || 0),
              adminBasePrice: Number(option.adminBasePrice || 0),
              adminSalePrice: Number(option.adminSalePrice || 0),
              images: option.existingImages || []   // keep old images
            });
          }
        }

        finalVariants.push({
          name: variant.name,
          options: optionsArray
        });
      }
    }

    /* ---------------- VARIANT IMAGE UPLOAD ---------------- */

    const variantFiles = req.files.filter(f =>
      f.fieldname.startsWith("variants[")
    );

    let fileIndex = 0;

    for (let variant of finalVariants) {
      for (let option of variant.options) {

        let newImages = [];

        const uploadCount = Number(option._imageCount || 0);

        for (let i = 0; i < uploadCount; i++) {
          const file = variantFiles[fileIndex++];

          if (file) {
            const uploaded = await uploadBuffer(file.buffer, {
              KeyPrefix: "products/variants/",
              contentType: file.mimetype
            });

            newImages.push(uploaded.location);
          }
        }

        option.images = [...option.images, ...newImages];
      }
    }

    /* ---------------- UPDATE FIELDS ---------------- */

    product.title = title || product.title;
    product.slug = title ? title.toLowerCase().replace(/\s+/g, "-") : product.slug;
    product.description = description;
    product.shortDescription = shortDescription;

    product.category = category;
    product.subCategory = subCategory;
    product.childCategory = childCategory;
    product.brand = brand;

    product.beautyTips = parsedBeautyTips;

    product.basePrice = Number(basePrice);
    product.salePrice = Number(salePrice || 0);
    product.adminBasePrice = Number(adminBasePrice || 0);
    product.adminSalePrice = Number(adminSalePrice || 0);

    product.variants = finalVariants;

    product.tags = safeParse(tags, []);
    product.ingredients = safeParse(ingredients, []);
    product.benefits = safeParse(benefits, []);
    product.howToUse = howToUse;

    product.weight = Number(weight);
    product.dimensions = parsedDimensions;

    product.seo = {
      title: parsedSeo.title,
      description: parsedSeo.description,
      keywords: safeParse(parsedSeo.keywords, [])
    };

    if (status) {
      product.status = status;
    }

    await product.save();

    return res.json({
      success: true,
      message: "Product updated successfully",
      product
    });

  } catch (err) {
    console.error("Update Product Error:", err);
    res.status(500).json({ error: err.message });
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
