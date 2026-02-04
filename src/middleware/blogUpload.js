const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "..", "uploads", "blogs");

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadRoot);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
    const timestamp = Date.now();
    cb(null, `${safeBase}_${timestamp}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image uploads are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Expect: single "title_image" and optional multiple "images"
const blogUpload = upload.fields([
  { name: "title_image", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

module.exports = blogUpload;

