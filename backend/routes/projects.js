const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { query }    = require('../db/connection');
const { protect }  = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// ─── GET /api/projects ───────────────────────────────────────
router.get('/', async (req, res) => {
  const { type, featured } = req.query;
  let conditions = [];
  const params   = [];
  let pi = 1;

  if (type) { conditions.push(`type = $${pi++}`); params.push(type); }
  if (featured === 'true') { conditions.push(`featured = true`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const result = await query(
      `SELECT * FROM projects ${where} ORDER BY sort_order ASC, created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/projects/:id ───────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/projects ──────────────────────────────────────
router.post('/',
  protect,
  [
    body('title').notEmpty().trim(),
    body('type').isIn(['dev','sec']),
    body('description').notEmpty().trim(),
    body('tech_stack').optional().isArray(),
    body('security_notes').optional().trim(),
    body('github_url').optional().isURL(),
    body('demo_url').optional().isURL(),
    body('featured').optional().isBoolean(),
    body('sort_order').optional().isInt(),
  ],
  validate,
  async (req, res) => {
    const {
      title, type, description, long_desc, tech_stack = [],
      security_notes, github_url, demo_url, featured = false, sort_order = 0,
    } = req.body;
    try {
      const result = await query(
        `INSERT INTO projects
           (title, type, description, long_desc, tech_stack, security_notes,
            github_url, demo_url, featured, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [title, type, description, long_desc, tech_stack, security_notes,
         github_url, demo_url, featured, sort_order]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ─── PATCH /api/projects/:id ─────────────────────────────────
router.patch('/:id', protect, async (req, res) => {
  const allowed = ['title','type','description','long_desc','tech_stack','security_notes',
                   'github_url','demo_url','featured','sort_order'];
  const fields  = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

  const sets   = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => req.body[f]);

  try {
    const result = await query(
      `UPDATE projects SET ${sets} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/projects/:id ────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id, title', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: `Deleted: "${result.rows[0].title}"` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
