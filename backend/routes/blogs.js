const express = require('express');
const router  = express.Router();
const { body, query: qParam } = require('express-validator');
const { query }    = require('../db/connection');
const { protect }  = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Helper: generate URL slug from title
const slugify = (str) =>
  str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100);

// ─── GET /api/blogs ─────────────────────────────────────────
// Public — list published posts with optional filters
router.get('/', async (req, res) => {
  const { category, tag, search, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = ['b.published = true'];
  const params   = [];
  let pi = 1;

  if (category) {
    conditions.push(`b.category = $${pi++}`);
    params.push(category);
  }
  if (tag) {
    conditions.push(`$${pi++} = ANY(b.tags)`);
    params.push(tag);
  }
  if (search) {
    conditions.push(`(b.title ILIKE $${pi} OR b.excerpt ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');

  try {
    const countRes = await query(
      `SELECT COUNT(*) FROM blog_posts b WHERE ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    const result = await query(
      `SELECT b.id, b.title, b.slug, b.excerpt, b.cover_emoji,
              b.category, b.tags, b.read_time_min, b.views,
              b.published_at, a.name AS author_name
       FROM blog_posts b
       LEFT JOIN admins a ON b.author_id = a.id
       WHERE ${where}
       ORDER BY b.published_at DESC
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/blogs/:slug ────────────────────────────────────
// Public — single post (increments view counter)
router.get('/:slug', async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, a.name AS author_name
       FROM blog_posts b
       LEFT JOIN admins a ON b.author_id = a.id
       WHERE b.slug = $1 AND b.published = true`,
      [req.params.slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Increment view count (non-blocking)
    query('UPDATE blog_posts SET views = views + 1 WHERE slug = $1', [req.params.slug]).catch(() => {});

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/blogs ─────────────────────────────────────────
// Admin only — create post
router.post('/',
  protect,
  [
    body('title').notEmpty().trim().withMessage('Title required'),
    body('content').notEmpty().withMessage('Content required'),
    body('category').isIn(['cybersecurity','webdev','ctf','tutorial']),
    body('excerpt').optional().trim(),
    body('tags').optional().isArray(),
    body('read_time_min').optional().isInt({ min: 1 }),
    body('published').optional().isBoolean(),
    body('cover_emoji').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const {
      title, content, category, excerpt = '', tags = [],
      read_time_min = 5, published = false, cover_emoji = '📝',
    } = req.body;

    const baseSlug = slugify(title);
    // Ensure slug uniqueness
    const existing = await query(
      `SELECT id FROM blog_posts WHERE slug LIKE $1 || '%'`, [baseSlug]
    );
    const slug = existing.rows.length ? `${baseSlug}-${Date.now()}` : baseSlug;

    try {
      const result = await query(
        `INSERT INTO blog_posts
           (title, slug, excerpt, content, cover_emoji, category, tags,
            read_time_min, published, published_at, author_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          title, slug, excerpt, content, cover_emoji, category, tags,
          read_time_min, published,
          published ? new Date() : null,
          req.admin.id,
        ]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ─── PATCH /api/blogs/:id ────────────────────────────────────
// Admin only — update post
router.patch('/:id', protect, async (req, res) => {
  const allowed = ['title','content','excerpt','category','tags','read_time_min','published','cover_emoji'];
  const fields  = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ success: false, message: 'No valid fields to update' });

  const sets   = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => req.body[f]);

  // Handle publish timestamp
  if (req.body.published === true) {
    const check = await query('SELECT published FROM blog_posts WHERE id = $1', [req.params.id]);
    if (!check.rows[0]?.published) {
      sets.concat(', published_at = NOW()');
      await query(
        `UPDATE blog_posts SET published_at = NOW() WHERE id = $1 AND published_at IS NULL`,
        [req.params.id]
      );
    }
  }

  try {
    const result = await query(
      `UPDATE blog_posts SET ${sets} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/blogs/:id ───────────────────────────────────
// Admin only
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM blog_posts WHERE id = $1 RETURNING id, title', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: `Deleted: "${result.rows[0].title}"` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/blogs/admin/all ────────────────────────────────
// Admin only — includes drafts
router.get('/admin/all', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, slug, category, tags, published, views, published_at, created_at
       FROM blog_posts ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
