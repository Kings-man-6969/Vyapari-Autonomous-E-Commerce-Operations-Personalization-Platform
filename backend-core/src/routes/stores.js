const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// GET /api/stores/:sellerId (Public Storefront)
router.get('/:sellerId', async (req, res, next) => {
  try {
    const { sellerId } = req.params;

    const storeRes = await query(
      `SELECT sp.*, u.name AS owner_name, u.email AS owner_email, u.created_at AS member_since
       FROM seller_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.user_id = $1::uuid OR sp.id = $1::uuid`,
      [sellerId]
    );

    if (storeRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'STORE_NOT_FOUND', message: 'Seller store not found.' } });
    }

    const store = storeRes.rows[0];

    // Fetch active products from this seller
    const productsRes = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.seller_id = $1 AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [store.user_id]
    );

    res.json({
      success: true,
      data: {
        store,
        products: productsRes.rows,
        total_products: productsRes.rows.length
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
