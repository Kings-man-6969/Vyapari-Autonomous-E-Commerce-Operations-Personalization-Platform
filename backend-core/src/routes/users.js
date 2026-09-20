const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/users/profile
router.get('/profile', async (req, res, next) => {
  try {
    const userRes = await query(
      `SELECT id, name, email, phone, role, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    const user = userRes.rows[0];

    // Additional stats
    const [ordersCount, wishlistCount] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM orders WHERE user_id = $1', [req.user.id]),
      query(
        `SELECT COUNT(*) AS count FROM wishlist_items wi
         JOIN wishlists w ON wi.wishlist_id = w.id
         WHERE w.user_id = $1`,
        [req.user.id]
      )
    ]);

    user.stats = {
      total_orders: parseInt(ordersCount.rows[0].count, 10),
      wishlist_items: parseInt(wishlistCount.rows[0].count, 10)
    };

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile
router.put('/profile', async (req, res, next) => {
  try {
    const { name, phone, current_password, new_password } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required.' } });
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          error: { code: 'PASSWORD_REQUIRED', message: 'Current password is required to set a new password.' }
        });
      }

      const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const isMatch = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Current password does not match.' }
        });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(new_password, salt);

      await query(
        'UPDATE users SET name = $1, phone = $2, password_hash = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [name.trim(), phone || null, newHash, req.user.id]
      );
    } else {
      await query(
        'UPDATE users SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [name.trim(), phone || null, req.user.id]
      );
    }

    const updatedRes = await query(
      'SELECT id, name, email, phone, role, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user: updatedRes.rows[0] }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/addresses
router.get('/addresses', async (req, res, next) => {
  try {
    const addressesRes = await query(
      `SELECT 
        id, full_name, full_name AS name, phone,
        line1, line1 AS address_line1, city, state,
        pincode, pincode AS postal_code, is_default, created_at
       FROM addresses 
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: addressesRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/addresses
router.post('/addresses', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { full_name, name, phone, line1, address_line1, city, state, pincode, postal_code, is_default = false } = req.body;
    const finalName = full_name || name;
    const finalLine = line1 || address_line1;
    const finalPin = pincode || postal_code;

    if (!finalName || !phone || !finalLine || !city || !state || !finalPin) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'All address fields are required.' }
      });
    }

    await client.query('BEGIN');

    // If marked default, unset existing defaults
    if (is_default) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    } else {
      // If user has no existing addresses, make this default automatically
      const countRes = await client.query('SELECT COUNT(*) AS count FROM addresses WHERE user_id = $1', [req.user.id]);
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        req.body.is_default = true;
      }
    }

    const insertRes = await client.query(
      `INSERT INTO addresses (user_id, full_name, phone, line1, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, full_name, full_name AS name, phone, line1, line1 AS address_line1, city, state, pincode, pincode AS postal_code, is_default, created_at`,
      [req.user.id, finalName.trim(), phone.trim(), finalLine.trim(), city.trim(), state.trim(), finalPin.trim(), Boolean(req.body.is_default)]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Address added successfully.',
      data: insertRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/users/addresses/:id
router.put('/addresses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, name, phone, line1, address_line1, city, state, pincode, postal_code } = req.body;
    const finalName = full_name || name;
    const finalLine = line1 || address_line1;
    const finalPin = pincode || postal_code;

    const updateRes = await query(
      `UPDATE addresses
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           line1 = COALESCE($3, line1),
           city = COALESCE($4, city),
           state = COALESCE($5, state),
           pincode = COALESCE($6, pincode)
       WHERE id = $7 AND user_id = $8
       RETURNING id, full_name, full_name AS name, phone, line1, line1 AS address_line1, city, state, pincode, pincode AS postal_code, is_default`,
      [
        finalName ? finalName.trim() : null,
        phone ? phone.trim() : null,
        finalLine ? finalLine.trim() : null,
        city ? city.trim() : null,
        state ? state.trim() : null,
        finalPin ? finalPin.trim() : null,
        id,
        req.user.id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found.' } });
    }

    res.json({ success: true, message: 'Address updated.', data: updateRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/addresses/:id
router.delete('/addresses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteRes = await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found.' } });
    }
    res.json({ success: true, message: 'Address deleted.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/addresses/:id/default
router.put('/addresses/:id/default', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    const updateRes = await client.query(
      'UPDATE addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found.' } });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Default address updated.', data: { address: updateRes.rows[0] } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
