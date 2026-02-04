const express = require("express");
const {
  createBlog,
  getBlogs,
  getBlogById,
} = require("../controllers/blogController");
const blogUpload = require("../middleware/blogUpload");

const router = express.Router();

// POST /api/blogs -> create a new blog (with image upload)
router.post("/", blogUpload, createBlog);

// GET /api/blogs -> list all blogs
router.get("/", getBlogs);

// GET /api/blogs/:id -> single blog by id
router.get("/:id", getBlogById);

module.exports = router;

