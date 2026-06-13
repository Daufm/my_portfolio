const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { query }    = require('../db/connection');
const { protect }  = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// ─── GET /api/writeups ───────────────────────────────────────
router.get('/', async (req, res) => {
  const { platform, difficulty, tag } = req.query;
  let conditions = ['published = true'];
  const params   = [];
  let pi = 1;

  if (platform)   { conditions.push(`platform = $${pi++}`);   params.push(platform); }
  if (difficulty) { conditions.push(`difficulty = $${pi++}`); params.push(difficulty); }
  if (tag)        { conditions.push(`$${pi++} = ANY(tags)`);  params.push(tag); }

  const where = conditions.join(' AND ');
  try {
    const result = await query(
      `SELECT id, title, platform, difficulty, summary, tags, steps, tools_used, views, created_at
       FROM writeups WHERE ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/writeups/admin/all ──────────────────────────────
// Admin only — includes drafts
router.get('/admin/all', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, platform, difficulty, summary, tags, steps, tools_used, published, views, created_at
       FROM writeups ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/writeups/:id ───────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM writeups WHERE id = $1 AND published = true',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    query('UPDATE writeups SET views = views + 1 WHERE id = $1', [req.params.id]).catch(() => {});
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/writeups ──────────────────────────────────────
router.post('/',
  protect,
  [
    body('title').notEmpty().trim(),
    body('platform').isIn(['tryhackme','hackthebox','ctf','vapt','custom']),
    body('difficulty').isIn(['easy','medium','hard','insane']),
    body('summary').notEmpty().trim(),
    body('content').notEmpty(),
    body('tags').optional().isArray(),
    body('steps').optional().isArray(),
    body('tools_used').optional().isArray(),
    body('published').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const {
      title, platform, difficulty, summary, content,
      tags = [], steps = [], tools_used = [], flag, published = false,
    } = req.body;
    try {
      const result = await query(
        `INSERT INTO writeups
           (title, platform, difficulty, summary, content, tags, steps, tools_used, flag, published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [title, platform, difficulty, summary, content, tags, steps, tools_used, flag, published]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ─── PATCH /api/writeups/:id ─────────────────────────────────
router.patch('/:id', protect, async (req, res) => {
  const allowed = ['title','platform','difficulty','summary','content','tags','steps','tools_used','flag','published'];
  const fields  = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

  const sets   = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => req.body[f]);

  try {
    const result = await query(
      `UPDATE writeups SET ${sets} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/writeups/:id ────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await query('DELETE FROM writeups WHERE id = $1 RETURNING id, title', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: `Deleted: "${result.rows[0].title}"` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
