
const Category = require("../models/Category");
const slugify = require("../utils/slugify");
const SubCategory = require("../models/SubCategory");
const ChildCategory = require("../models/ChildCategory");
const { uploadBuffer } = require("../config/s3");

exports.createCategory = async (req, res) => {
  try {
    let imageUrl = null;

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "categories/",
        contentType: req.file.mimetype
      });
      imageUrl = uploaded.location || uploaded.Location;
    }

    const category = new Category({
      name: req.body.name,
      slug: req.body.name.toLowerCase().replace(/\s+/g, "-"),
      image: imageUrl
    });

    await category.save();

    res.json({ success: true, category });
  } catch (err) {
    console.error("Create Category Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE CATEGORY
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const update = {
      name,
      slug: slugify(name)
    };

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "categories/",
        contentType: req.file.mimetype
      });
      update.image = uploaded.location || uploaded.Location;
    }

    const category = await Category.findByIdAndUpdate(id, update, { new: true });

    res.json({ success: true, category });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// TOGGLE STATUS
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    category.isActive = !category.isActive;
    await category.save();

    res.json({ success: true, isActive: category.isActive });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE CATEGORY
exports.deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// CREATE
exports.createSubCategory = async (req, res) => {
  try {
    const { categoryId, name } = req.body;

    let image = null;
    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "subcategories/",
        contentType: req.file.mimetype
      });
      image = uploaded.location || uploaded.Location;
    }

    const subCategory = await SubCategory.create({
      categoryId,
      name,
      slug: slugify(name),
      image
    });

    res.json({ success: true, subCategory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// UPDATE
exports.updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId } = req.body;

    const update = {
      name,
      categoryId,
      slug: slugify(name)
    };

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "subcategories/",
        contentType: req.file.mimetype
      });
      update.image = uploaded.location || uploaded.Location;
    }

    const subCategory = await SubCategory.findByIdAndUpdate(id, update, { new: true });

    res.json({ success: true, subCategory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// TOGGLE STATUS
exports.toggleSubCategoryStatus = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id);
    subCategory.isActive = !subCategory.isActive;
    await subCategory.save();

    res.json({ success: true, isActive: subCategory.isActive });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE
exports.deleteSubCategory = async (req, res) => {
  try {
    await SubCategory.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createChildCategory = async (req, res) => {
  try {
    const { categoryId, subCategoryId, name } = req.body;

    let image = null;
    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "childcategories/",
        contentType: req.file.mimetype
      });
      image = uploaded.location || uploaded.Location;
    }

    const childCategory = await ChildCategory.create({
      categoryId,
      subCategoryId,
      name,
      slug: slugify(name),
      image
    });

    res.json({ success: true, childCategory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// UPDATE
exports.updateChildCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId, subCategoryId } = req.body;

    const update = {
      name,
      categoryId,
      subCategoryId,
      slug: slugify(name)
    };

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "childcategories/",
        contentType: req.file.mimetype
      });
      update.image = uploaded.location || uploaded.Location;
    }

    const childCategory = await ChildCategory.findByIdAndUpdate(id, update, { new: true });

    res.json({ success: true, childCategory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// TOGGLE STATUS
exports.toggleChildCategoryStatus = async (req, res) => {
  try {
    const childCategory = await ChildCategory.findById(req.params.id);
    childCategory.isActive = !childCategory.isActive;
    await childCategory.save();

    res.json({ success: true, isActive: childCategory.isActive });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE
exports.deleteChildCategory = async (req, res) => {
  try {
    await ChildCategory.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};