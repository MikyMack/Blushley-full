const Banner = require("../models/Banner");
const Poster = require("../models/Poster");
const { uploadBuffer } = require("../config/s3");

// LIST
exports.bannerList = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE
exports.bannerCreate = async (req, res) => {
  try {
    const { title, subtitle, description, link } = req.body;

    let imageUrl = "";
    if (req.file && req.file.buffer) {
      // Conform S3 input to use options object (like blogController.js)
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "banners/",
        contentType: req.file.mimetype
      });
      imageUrl = uploaded.location;
    } else if (req.file) {
      // fallback if no buffer (local path or Multer S3 already set)
      imageUrl = req.file.location || req.file.path || "";
    }

    const banner = await Banner.create({
      title,
      subtitle,
      description,
      link,
      image: imageUrl
    });

    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// EDIT / UPDATE
exports.bannerUpdate = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const { title, subtitle, description, link, isActive } = req.body;

    let updateData = { title, subtitle, description, link };

    if (typeof isActive !== "undefined") {
      updateData.isActive = isActive;
    }

    if (req.file && req.file.buffer) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "banners/",
        contentType: req.file.mimetype
      });
      updateData.image = uploaded.location;
    } else if (req.file) {
      updateData.image = req.file.location || req.file.path || "";
    }

    const banner = await Banner.findByIdAndUpdate(bannerId, updateData, { new: true });

    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// TOGGLE ACTIVE STATUS
exports.bannerToggleActive = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const banner = await Banner.findById(bannerId);

    if (!banner) return res.status(404).json({ error: "Banner not found" });

    banner.isActive = !banner.isActive;
    await banner.save();

    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.bannerDelete = async (req, res) => {
  try {
    const bannerId = req.params.id;
    await Banner.findByIdAndDelete(bannerId);

    res.json({ success: true, message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// LIST
exports.posterList = async (req, res) => {
  try {
    const posters = await Poster.find().sort({ createdAt: -1 });
    res.json({ success: true, posters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE
exports.posterCreate = async (req, res) => {
  try {
    const { title, subtitle, description, link } = req.body;

    let imageUrl = "";
    if (req.file && req.file.buffer) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "posters/",
        contentType: req.file.mimetype
      });
      imageUrl = uploaded.location;
    } else if (req.file) {
      imageUrl = req.file.location || req.file.path || "";
    }

    const poster = await Poster.create({
      title,
      subtitle,
      description,
      link,
      image: imageUrl
    });

    res.json({ success: true, poster });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// EDIT
exports.posterUpdate = async (req, res) => {
  try {
    const posterId = req.params.id;
    const { title, subtitle, description, link, isActive } = req.body;

    let updateData = { title, subtitle, description, link };

    if (typeof isActive !== "undefined") {
      updateData.isActive = isActive;
    }

    if (req.file && req.file.buffer) {
      const uploaded = await uploadBuffer(req.file.buffer, {
        KeyPrefix: "posters/",
        contentType: req.file.mimetype
      });
      updateData.image = uploaded.location;
    } else if (req.file) {
      updateData.image = req.file.location || req.file.path || "";
    }

    const poster = await Poster.findByIdAndUpdate(posterId, updateData, { new: true });

    res.json({ success: true, poster });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// TOGGLE ACTIVE
exports.posterToggleActive = async (req, res) => {
  try {
    const posterId = req.params.id;
    const poster = await Poster.findById(posterId);

    if (!poster) return res.status(404).json({ error: "Poster not found" });

    poster.isActive = !poster.isActive;
    await poster.save();

    res.json({ success: true, poster });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.posterDelete = async (req, res) => {
  try {
    const posterId = req.params.id;
    await Poster.findByIdAndDelete(posterId);

    res.json({ success: true, message: "Poster deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};