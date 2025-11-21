const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, 
  },
  fileFilter: function (req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only jpg, png, webp allowed"), false);
    }
    cb(null, true);
  }
});

module.exports = upload;
