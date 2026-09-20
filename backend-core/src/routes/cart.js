const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Helper to get or create cart
async function getOrCreateCart(userId) {
  let cartRes = await query('SELECT id FROM carts WHERE user_id = $1', [userId]);
  if (cartRes.rows.length === 0) {
    cartRes = await query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
  }
  return cartRes.rows[0].id;
}

// GET /api/cart
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.id);

    const itemsRes = await query(
      `SELECT 
        ci.id AS cart_item_id,
        ci.quantity,
        ci.created_at,
        p.id AS product_id,
        p.title,
        p.price,
        p.compare_at_price,
        p.stock_qty,
        p.status,
        p.images,
        sp.store_name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       JOIN seller_profiles sp ON p.seller_id = sp.user_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at DESC`,
      [cartId]
    );

    const items = itemsRes.rows.map(item => ({
      ...item,
      is_available: item.status === 'active' && item.stock_qty >= item.quantity,
      subtotal: parseFloat(item.price) * item.quantity
    }));

    const totalAmount = items
      .filter(i => i.is_available)
      .reduce((sum, i) => sum + i.subtotal, 0);

    res.json({
      success: true,
      data: {
        cart_id: cartId,
        items,
        total_amount: Math.round(totalAmount * 100) / 100,
        item_count: items.reduce((count, i) => count + i.quantity, 0)
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/items
router.post('/items', requireAuth, async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid product_id and quantity > 0 are required.' }
      });
    }

    // Check product existence and stock
    const productRes = await query('SELECT id, stock_qty, status, price FROM products WHERE id = $1', [product_id]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product does not exist.' }
      });
    }

    const product = productRes.rows[0];
    if (product.status !== 'active' || product.stock_qty < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'OUT_OF_STOCK', message: 'This item is currently out of stock.' }
      });
    }

    const cartId = await getOrCreateCart(req.user.id);

    // Upsert cart item
    await query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $4), updated_at = CURRENT_TIMESTAMP`,
      [cartId, product_id, quantity, product.stock_qty]
    );

    // Log interaction only after database write succeeds per event contract
    query(
      `INSERT INTO user_interactions (user_id, product_id, event_type)
       VALUES ($1, $2, 'add_to_cart')`,
      [req.user.id, product_id]
    ).catch(() => {});

    res.json({
      success: true,
      message: 'Item added to cart.'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/cart/items/:id
router.put('/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Quantity must be a valid number.' }
      });
    }

    const cartId = await getOrCreateCart(req.user.id);

    if (quantity <= 0) {
      await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [id, cartId]);
      return res.json({ success: true, message: 'Item removed from cart.' });
    }

    // Verify stock
    const itemRes = await query(
      `SELECT ci.id, p.stock_qty 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.id = $1 AND ci.cart_id = $2`,
      [id, cartId]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CART_ITEM_NOT_FOUND', message: 'Cart item not found.' }
      });
    }

    const cappedQuantity = Math.min(quantity, itemRes.rows[0].stock_qty);

    await query(
      'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [cappedQuantity, id]
    );

    res.json({
      success: true,
      data: { quantity: cappedQuantity }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/items/:id
router.delete('/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const cartId = await getOrCreateCart(req.user.id);
    await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [id, cartId]);
    res.json({ success: true, message: 'Item removed.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart (Clear)
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.id);
    await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
