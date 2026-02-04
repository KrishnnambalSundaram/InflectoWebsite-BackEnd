const pool = require("../database");

let isTableInitialized = false;

async function ensureBlogsTable() {
  if (isTableInitialized) return;
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS blogs (
      id SERIAL PRIMARY KEY,
      blog_title TEXT NOT NULL,
      author TEXT,
      category TEXT,
      blog_keywords TEXT[],
      title_image TEXT,
      images TEXT[],
      blog_description TEXT,
      blog_points JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await pool.query(createTableQuery);
  isTableInitialized = true;
}

exports.createBlog = async (req, res) => {
  try {
    await ensureBlogsTable();

    const {
      blog_title,
      author,
      category,
      blog_keywords,
      blog_description,
      blog_points,
    } = req.body;

    const files = req.files || {};
    const titleImageFile = Array.isArray(files.title_image)
      ? files.title_image[0]
      : null;
    const imageFiles = Array.isArray(files.images) ? files.images : [];

    if (!blog_title || !blog_description) {
      return res.status(400).json({
        error: "blog_title and blog_description are required",
      });
    }

    const keywordsArray = Array.isArray(blog_keywords)
      ? blog_keywords
      : typeof blog_keywords === "string" && blog_keywords.trim()
      ? blog_keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

    const titleImagePath = titleImageFile
      ? `/uploads/blogs/${titleImageFile.filename}`
      : null;

    const imagesArray =
      imageFiles.length > 0
        ? imageFiles.map((f) => `/uploads/blogs/${f.filename}`)
        : [];

    let parsedPoints = [];
    if (Array.isArray(blog_points)) {
      parsedPoints = blog_points;
    } else if (typeof blog_points === "string" && blog_points.trim()) {
      parsedPoints = safeParseJSON(blog_points);
    }

    const pointsValue =
      Array.isArray(parsedPoints) && parsedPoints.length > 0
        ? JSON.stringify(parsedPoints)
        : null;

    const insertQuery = `
      INSERT INTO blogs (
        blog_title,
        author,
        category,
        blog_keywords,
        title_image,
        images,
        blog_description,
        blog_points
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      blog_title,
      author || null,
      category || null,
      keywordsArray.length ? keywordsArray : null,
      titleImagePath,
      imagesArray.length ? imagesArray : null,
      blog_description,
      pointsValue,
    ];

    const result = await pool.query(insertQuery, values);
    const row = result.rows[0];

    return res.status(201).json({
      message: "Blog created successfully",
      data: mapBlogRowToResponse(row),
    });
  } catch (error) {
    console.error("❌ Error creating blog:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getBlogs = async (req, res) => {
  try {
    await ensureBlogsTable();

    const result = await pool.query(
      "SELECT * FROM blogs ORDER BY created_at DESC, id DESC"
    );

    const blogs = result.rows.map(mapBlogRowToResponse);

    return res.status(200).json(blogs);
  } catch (error) {
    console.error("❌ Error fetching blogs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getBlogById = async (req, res) => {
  try {
    await ensureBlogsTable();

    const { id } = req.params;
    const result = await pool.query("SELECT * FROM blogs WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }

    return res.status(200).json(mapBlogRowToResponse(result.rows[0]));
  } catch (error) {
    console.error("❌ Error fetching blog by id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

function mapBlogRowToResponse(row) {
  const points =
    typeof row.blog_points === "string"
      ? safeParseJSON(row.blog_points)
      : row.blog_points || [];

  return {
    id: row.id,
    title: row.blog_title,
    author: row.author || "Inflecto Technologies",
    category: row.category || "AI & Automation",
    date: row.created_at,
    description: row.blog_description,
    tags: row.blog_keywords || [],
    image: row.title_image,
    content: row.blog_description,
    points: Array.isArray(points) ? points : [],
  };
}

function safeParseJSON(value) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

