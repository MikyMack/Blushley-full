const Blog = require("../models/Blog");
const { uploadBuffer } = require("../config/s3");

/* Simple slug helper */
const slugify = (text) =>
  text.toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-");

/* Safe JSON Parse */
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

/* ---------------- CREATE BLOG ---------------- */
exports.createBlog = async (req, res) => {
  try {
    const {
      title,
      shortDescription,
      fullDescription,
      category,
      tags,
      highlights,
      authorName,
      seo
    } = req.body;

    if (!title || !fullDescription || !authorName) {
      return res.status(400).json({
        error: "Title, full description and author name are required"
      });
    }

    const slug = slugify(title);

    // Check unique slug
    const existing = await Blog.findOne({ slug });
    if (existing) {
      return res.status(409).json({ error: "Blog with this title already exists" });
    }

    // Upload main blog image
    let image = null;
    if (req.files?.image?.[0]) {
      const file = req.files.image[0];
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "blogs/",
        contentType: file.mimetype
      });
      image = uploaded.location;
    }

    const parsedSeo = safeParse(seo, {});
    const parsedTags = safeParse(tags, []);
    const parsedHighlights = safeParse(highlights, []);

    const blog = await Blog.create({
      title,
      slug,
      shortDescription,
      fullDescription,
      image,

      author: { name: authorName },

      category,
      tags: parsedTags,
      highlights: parsedHighlights,

      seo: {
        metaTitle: parsedSeo.metaTitle || title,
        metaDescription: parsedSeo.metaDescription || shortDescription,
        keywords: safeParse(parsedSeo.keywords, []),
        ogTitle: parsedSeo.ogTitle || title,
        ogDescription: parsedSeo.ogDescription || shortDescription,
        ogImage: parsedSeo.ogImage || image,
        canonicalUrl: parsedSeo.canonicalUrl || null
      },

      status: "draft"
    });

    res.json({
      success: true,
      message: "Blog created successfully",
      blog
    });

  } catch (err) {
    console.error("Create Blog Error:", err);
    res.status(500).json({ error: err.message });
  }
};


/* ---------------- UPDATE BLOG ---------------- */
exports.updateBlog = async (req, res) => {
  try {
    const blogId = req.params.id;
    const blog = await Blog.findById(blogId);

    if (!blog) return res.status(404).json({ error: "Blog not found" });

    const {
      title,
      shortDescription,
      fullDescription,
      category,
      tags,
      highlights,
      authorName,
      seo,
      status
    } = req.body;

    if (title) {
      blog.title = title;
      blog.slug = slugify(title);
    }

    if (fullDescription) blog.fullDescription = fullDescription;
    if (shortDescription) blog.shortDescription = shortDescription;
    if (category) blog.category = category;
    if (authorName) blog.author.name = authorName;

    blog.tags = safeParse(tags, blog.tags);
    blog.highlights = safeParse(highlights, blog.highlights);

    // Update image if provided
    if (req.files?.image?.[0]) {
      const file = req.files.image[0];
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "blogs/",
        contentType: file.mimetype
      });
      blog.image = uploaded.location;
    }

    const parsedSeo = safeParse(seo, {});
    blog.seo.metaTitle = parsedSeo.metaTitle || blog.seo.metaTitle;
    blog.seo.metaDescription = parsedSeo.metaDescription || blog.seo.metaDescription;
    blog.seo.keywords = safeParse(parsedSeo.keywords, blog.seo.keywords);
    blog.seo.ogTitle = parsedSeo.ogTitle || blog.seo.ogTitle;
    blog.seo.ogDescription = parsedSeo.ogDescription || blog.seo.ogDescription;
    blog.seo.ogImage = parsedSeo.ogImage || blog.image;
    blog.seo.canonicalUrl = parsedSeo.canonicalUrl || blog.seo.canonicalUrl;

    // Publish handling
    if (status && status === "published") {
      blog.status = "published";
      blog.publishedAt = new Date();
    } else if (status) {
      blog.status = status;
    }

    await blog.save();

    res.json({
      success: true,
      message: "Blog updated successfully",
      blog
    });

  } catch (err) {
    console.error("Update Blog Error:", err);
    res.status(500).json({ error: err.message });
  }
};


/* ---------------- GET ALL BLOGS ---------------- */
exports.getAllBlogs = async (req, res) => {
  const blogs = await Blog.find().populate("category").sort({ createdAt: -1 });
  res.json(blogs);
};


/* ---------------- GET BLOG BY SLUG ---------------- */
exports.getBlogBySlug = async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug }).populate("category");

  if (!blog) {
    return res.status(404).json({ error: "Blog not found" });
  }

  blog.views++;
  await blog.save();

  res.json(blog);
};


/* ---------------- DELETE BLOG ---------------- */
exports.deleteBlog = async (req, res) => {
  await Blog.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Blog deleted successfully" });
};
