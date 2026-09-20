const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'vyapari_jwt_access_secret_sample_key_change_in_production_384b';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'vyapari_jwt_refresh_secret_sample_key_change_in_production_384b';

function generateTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'customer', phone, storeName, businessInfo } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' }
      });
    }

    if (!['customer', 'seller'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be either customer or seller.' }
      });
    }

    // Check duplicate
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, email, role, phone, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role, phone || null]
    );
    const user = userRes.rows[0];

    // Create cart and wishlist
    await query('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    await query('INSERT INTO wishlists (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

    // If seller, create seller profile
    let sellerProfile = null;
    if (role === 'seller') {
      const store = storeName ? storeName.trim() : `${user.name}'s Store`;
      const profileRes = await query(
        `INSERT INTO seller_profiles (user_id, store_name, business_info, is_verified)
         VALUES ($1, $2, $3::jsonb, true)
         RETURNING id, store_name, rating_avg, is_verified`,
        [user.id, store, JSON.stringify(businessInfo || {})]
      );
      sellerProfile = profileRes.rows[0];
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Set HTTP-only cookie for refresh token per UX contract
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: { ...user, seller_profile: sellerProfile },
        access_token: accessToken
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
      });
    }

    const userRes = await query(
      `SELECT id, name, email, password_hash, role, phone, is_active 
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been deactivated. Please contact support.' }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    delete user.password_hash;

    // Fetch seller profile if seller
    if (user.role === 'seller') {
      const sp = await query('SELECT id, store_name, rating_avg, is_verified FROM seller_profiles WHERE user_id = $1', [user.id]);
      user.seller_profile = sp.rows[0] || null;
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      data: {
        user,
        access_token: accessToken
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = (req.cookies && req.cookies.refresh_token) || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token is required.' }
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const userRes = await query(
      'SELECT id, name, email, role, phone, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'User session is invalid.' }
      });
    }

    const user = userRes.rows[0];
    const { accessToken } = generateTokens(user);

    res.json({
      success: true,
      data: { access_token: accessToken }
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token has expired or is invalid.' }
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('refresh_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userRes = await query(
      'SELECT id, name, email, role, phone, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    const user = userRes.rows[0];
    if (user.role === 'seller') {
      const sp = await query('SELECT * FROM seller_profiles WHERE user_id = $1', [user.id]);
      user.seller_profile = sp.rows[0] || null;
    }

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
