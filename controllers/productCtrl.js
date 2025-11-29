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

    const updateObj = {
      title: title || product.title,
      slug: title
        ? title.toLowerCase().replace(/\s+/g, "-")
        : product.slug,

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
