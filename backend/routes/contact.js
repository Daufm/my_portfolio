const express   = require('express');
const router    = express.Router();
const nodemailer = require('nodemailer');
const { body }  = require('express-validator');
const { query }    = require('../db/connection');
const { protect }  = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── POST /api/contact ───────────────────────────────────────
router.post('/',
  [
    body('name').notEmpty().trim().isLength({ max: 100 }).withMessage('Name required (max 100 chars)'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('message').notEmpty().isLength({ min: 10, max: 5000 }).withMessage('Message must be 10–5000 chars'),
    body('subject').optional().trim().isLength({ max: 300 }),
  ],
  validate,
  async (req, res) => {
    const { name, email, subject = 'Portfolio Contact', message } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const ua = req.headers['user-agent'];

    try {
      // Save to DB
      const result = await query(
        `INSERT INTO contact_messages (name, email, subject, message, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6) RETURNING id, created_at`,
        [name, email, subject, message, ip, ua]
      );

      // Send email notification (non-blocking — don't fail request if email fails)
      if (process.env.SMTP_USER && process.env.CONTACT_RECIPIENT) {
        transporter.sendMail({
          from:    `"Portfolio Contact" <${process.env.SMTP_USER}>`,
          to:      process.env.CONTACT_RECIPIENT,
          subject: `[Portfolio] ${subject}`,
          html: `
            <div style="font-family:monospace;background:#050810;color:#e2e8f0;padding:2rem;border-radius:8px">
              <h2 style="color:#00ff88">New Contact Message</h2>
              <p><strong style="color:#00bfff">From:</strong> ${name} &lt;${email}&gt;</p>
              <p><strong style="color:#00bfff">Subject:</strong> ${subject}</p>
              <hr style="border-color:#1a1a2e"/>
              <p style="white-space:pre-wrap">${message}</p>
              <hr style="border-color:#1a1a2e"/>
              <small style="color:#64748b">Message ID: ${result.rows[0].id} | ${result.rows[0].created_at}</small>
            </div>
          `,
        }).catch(err => console.warn('Email notification failed:', err.message));
      }

      res.status(201).json({
        success: true,
        message: 'Message received! I\'ll get back to you within 24 hours.',
        id: result.rows[0].id,
      });
    } catch (err) {
      console.error('Contact error:', err);
      res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
    }
  }
);

// ─── GET /api/contact ─────────────────────────────────────────
// Admin only — view all messages
router.get('/', protect, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '';
  const params = [];
  if (status) { where = 'WHERE status = $1'; params.push(status); }

  try {
    const countRes = await query(`SELECT COUNT(*) FROM contact_messages ${where}`, params);
    const result   = await query(
      `SELECT * FROM contact_messages ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/contact/:id ───────────────────────────────────
// Admin — mark read/replied/archived
router.patch('/:id', protect, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['unread','read','replied','archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    const updates = status === 'replied'
      ? 'status = $1, replied_at = NOW()'
      : 'status = $1';
    const result = await query(
      `UPDATE contact_messages SET ${updates} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
