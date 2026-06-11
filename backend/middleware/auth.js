const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

/**
 * Verifies JWT and attaches admin to req.admin.
 * Rejects with 401 if token is missing/invalid/expired.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided — authorization denied',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, name, email FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Admin no longer exists' });
    }

    req.admin = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired — please log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Signs a JWT for the given admin id.
 */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = { protect, signToken };
