const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Helper to get or create wishlist
async function getOrCreateWishlist(userId) {
  let wRes = await query('SELECT id FROM wishlists WHERE user_id = $1', [userId]);
  if (wRes.rows.length === 0) {
    wRes = await query('INSERT INTO wishlists (user_id) VALUES ($1) RETURNING id', [userId]);
  }
  return wRes.rows[0].id;
}

// GET /api/wishlist
router.get('/', async (req, res, next) => {
  try {
    const wishlistId = await getOrCreateWishlist(req.user.id);

    const itemsRes = await query(
      `SELECT 
        wi.id AS wishlist_item_id,
        wi.added_at,
        p.id AS product_id,
        p.title,
        p.slug,
        p.price,
        p.compare_at_price,
        p.stock_qty,
        p.status,
        p.images,
        sp.store_name,
        c.name AS category_name
       FROM wishlist_items wi
       JOIN products p ON wi.product_id = p.id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE wi.wishlist_id = $1
       ORDER BY wi.added_at DESC`,
      [wishlistId]
    );

    res.json({
      success: true,
      data: {
        items: itemsRes.rows,
        total_count: itemsRes.rows.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/wishlist (Accepts product_id in body)
router.post('/', async (req, res, next) => {
  try {
    const productId = req.body.product_id || req.body.productId;
    if (!productId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'product_id is required.' } });
    }
    const wishlistId = await getOrCreateWishlist(req.user.id);

    const prodRes = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
    }

    await query(
      `INSERT INTO wishlist_items (wishlist_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (wishlist_id, product_id) DO NOTHING`,
      [wishlistId, productId]
    );

    query(
      `INSERT INTO user_interactions (user_id, product_id, event_type)
       VALUES ($1, $2, 'wishlist')`,
      [req.user.id, productId]
    ).catch(() => {});

    res.json({ success: true, message: 'Added to wishlist.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/wishlist/:productId
router.post('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const wishlistId = await getOrCreateWishlist(req.user.id);

    // Verify product exists
    const prodRes = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
    }

    await query(
      `INSERT INTO wishlist_items (wishlist_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (wishlist_id, product_id) DO NOTHING`,
      [wishlistId, productId]
    );

    // Log interaction
    query(
      `INSERT INTO user_interactions (user_id, product_id, event_type)
       VALUES ($1, $2, 'wishlist')`,
      [req.user.id, productId]
    ).catch(() => {});

    res.json({ success: true, message: 'Added to wishlist.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/wishlist/:productId
router.delete('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const wishlistId = await getOrCreateWishlist(req.user.id);

    await query(
      'DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2',
      [wishlistId, productId]
    );

    res.json({ success: true, message: 'Removed from wishlist.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
