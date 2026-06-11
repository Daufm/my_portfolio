const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { body } = require('express-validator');
const { query }      = require('../db/connection');
const { signToken, protect } = require('../middleware/auth');
const { validate }   = require('../middleware/validate');

// ─── POST /api/auth/login ──────────────────────────────────
router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await query(
        'SELECT id, name, email, password FROM admins WHERE email = $1',
        [email]
      );

      const admin = result.rows[0];
      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Update last_login
      await query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

      const token = signToken(admin.id);

      res.json({
        success: true,
        token,
        admin: { id: admin.id, name: admin.name, email: admin.email },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ─── GET /api/auth/me ──────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ─── POST /api/auth/change-password ───────────────────────
router.post('/change-password',
  protect,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Min 8 characters'),
  ],
  validate,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
      const result = await query(
        'SELECT password FROM admins WHERE id = $1', [req.admin.id]
      );
      const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
      if (!valid) return res.status(400).json({ success: false, message: 'Wrong current password' });

      const hash = await bcrypt.hash(newPassword, 12);
      await query('UPDATE admins SET password = $1 WHERE id = $2', [hash, req.admin.id]);
      res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

module.exports = router;
