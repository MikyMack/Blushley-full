const BeautyTip = require("../models/BeautyTip");
const { uploadBuffer } = require("../config/s3");

exports.listBeautyTips = async (req, res) => {
  try {
    const tips = await BeautyTip.find()
      .populate("category")
      .populate("relatedProducts")
      .sort({ createdAt: -1 });
    res.json({ tips });
  } catch (err) {
    console.error("Error fetching beauty tips:", err);
    res.status(500).json({ error: "Failed to fetch beauty tips" });
  }
};

exports.createBeautyTip = async (req, res) => {
  try {
    const {
      title,
      slug,
      shortDescription,
      fullDescription,
      category,
      relatedProducts,
      tags,
      status
    } = req.body;

    let image = undefined;
    if (req.file) {
      // uploadBuffer expects a buffer and returns { location/Location }
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "beautytips/",
        contentType: req.file.mimetype
      });
      image = uploaded.location || uploaded.Location;
    }

    const tip = new BeautyTip({
      title,
      slug,
      shortDescription,
      fullDescription,
      category,
      relatedProducts: relatedProducts
        ? Array.isArray(relatedProducts)
          ? relatedProducts
          : [relatedProducts]
        : [],
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      image,
      status
    });

    await tip.save();

    res.status(201).json({ message: "Beauty tip created successfully", tip });
  } catch (err) {
    console.error("Error creating beauty tip:", err);
    res.status(500).json({ error: "Failed to create beauty tip" });
  }
};

exports.updateBeautyTip = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      title,
      slug,
      shortDescription,
      fullDescription,
      category,
      relatedProducts,
      tags,
      status
    } = req.body;

    let updateData = {
      title,
      slug,
      shortDescription,
      fullDescription,
      category,
      status,
    };

    if (typeof relatedProducts !== 'undefined') {
      updateData.relatedProducts = Array.isArray(relatedProducts) ? relatedProducts : [relatedProducts];
    }

    if (typeof tags !== 'undefined') {
      updateData.tags = Array.isArray(tags) ? tags : [tags];
    }

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "beautytips/",
        contentType: req.file.mimetype
      });
      updateData.image = uploaded.location || uploaded.Location;
    }

    const tip = await BeautyTip.findByIdAndUpdate(id, updateData, { new: true });

    if (!tip) {
      return res.status(404).json({ error: "Beauty tip not found" });
    }

    res.json({ message: "Beauty tip updated successfully", tip });
  } catch (err) {
    console.error("Error updating beauty tip:", err);
    res.status(500).json({ error: "Failed to update beauty tip" });
  }
};

exports.deleteBeautyTip = async (req, res) => {
  try {
    const id = req.params.id;
    const tip = await BeautyTip.findByIdAndDelete(id);
    if (!tip) {
      return res.status(404).json({ error: "Beauty tip not found" });
    }
    res.json({ message: "Beauty tip deleted successfully" });
  } catch (err) {
    console.error("Error deleting beauty tip:", err);
    res.status(500).json({ error: "Failed to delete beauty tip" });
  }
};

exports.toggleBeautyTipStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const tip = await BeautyTip.findById(id);

    if (!tip) {
      return res.status(404).json({ error: "Beauty tip not found" });
    }

    const statuses = ["draft", "published", "archived"];
    const currentIdx = statuses.indexOf(tip.status);
    const nextStatus = statuses[(currentIdx + 1) % statuses.length];

    tip.status = nextStatus;
    await tip.save();

    res.json({ message: "Beauty tip status updated", status: nextStatus });
  } catch (err) {
    console.error("Error toggling beauty tip status:", err);
    res.status(500).json({ error: "Failed to update beauty tip status" });
  }
};
