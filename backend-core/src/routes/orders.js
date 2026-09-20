const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/orders (Customer orders)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const ordersRes = await query(
      `SELECT 
        o.id, o.total_amount, o.status, o.created_at,
        p.status AS payment_status, p.payment_gateway,
        COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id, p.status, p.payment_gateway
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: { orders: ordersRes.rows }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id (Detail + Status Timeline)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const orderRes = await query(
      `SELECT o.*, p.status AS payment_status, p.provider_ref, p.payment_gateway
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       WHERE o.id = $1::uuid AND (o.user_id = $2 OR $3 = 'admin')`,
      [id, req.user.id, req.user.role]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' }
      });
    }

    const order = orderRes.rows[0];

    const [itemsRes, historyRes] = await Promise.all([
      query(
        `SELECT oi.*, p.title, p.images, sp.store_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN seller_profiles sp ON oi.seller_id = sp.user_id
         WHERE oi.order_id = $1`,
        [id]
      ),
      query(
        `SELECT id, status, note, changed_at 
         FROM order_status_history 
         WHERE order_id = $1 
         ORDER BY changed_at ASC`,
        [id]
      )
    ]);

    res.json({
      success: true,
      data: {
        order,
        items: itemsRes.rows,
        timeline: historyRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders (Create with SELECT FOR UPDATE atomic transaction)
router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { shipping_address, items } = req.body;

    if (!shipping_address || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid shipping_address and items array required.' }
      });
    }

    await client.query('BEGIN');

    let totalAmount = 0;
    const validatedItems = [];

    // Atomically lock and verify each item's stock
    for (const item of items) {
      const pRes = await client.query(
        'SELECT id, title, price, stock_qty, status, seller_id FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );

      if (pRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.product_id} no longer exists.` }
        });
      }

      const product = pRes.rows[0];
      if (product.status !== 'active' || product.stock_qty < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `"${product.title}" has only ${product.stock_qty} units available.`
          }
        });
      }

      const price = parseFloat(product.price);
      totalAmount += price * item.quantity;
      validatedItems.push({
        product_id: product.id,
        seller_id: product.seller_id,
        quantity: item.quantity,
        price,
        new_stock: product.stock_qty - item.quantity
      });
    }

    // 1. Create Order
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, status, shipping_address)
       VALUES ($1, $2, 'pending', $3::jsonb)
       RETURNING id, total_amount, status, created_at`,
      [req.user.id, totalAmount, JSON.stringify(shipping_address)]
    );
    const orderId = orderRes.rows[0].id;

    // 2. Insert Order Items and decrement stock
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.seller_id, item.quantity, item.price]
      );

      // Decrement stock & auto-update to out_of_stock if 0
      const newStatus = item.new_stock === 0 ? 'out_of_stock' : 'active';
      await client.query(
        'UPDATE products SET stock_qty = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [item.new_stock, newStatus, item.product_id]
      );
    }

    // 3. Initial Status History
    await client.query(
      `INSERT INTO order_status_history (order_id, status, note, changed_by)
       VALUES ($1, 'pending', 'Order placed by customer', $2)`,
      [orderId, req.user.id]
    );

    // 4. Initial Payment Record
    const paymentRes = await client.query(
      `INSERT INTO payments (order_id, amount, status, payment_gateway, provider_ref)
       VALUES ($1, $2, 'created', 'razorpay', $3)
       RETURNING id, status, amount`,
      [orderId, totalAmount, `rzp_order_${Date.now()}`]
    );

    // Clear items from cart
    await client.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [req.user.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        order_id: orderId,
        total_amount: totalAmount,
        status: 'pending',
        payment: paymentRes.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/orders/:id/confirm-payment (Simulate or Webhook confirmation)
router.post('/:id/confirm-payment', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { razorpay_payment_id = `pay_mock_${Date.now()}` } = req.body;

    await client.query('BEGIN');

    // Update order status
    const orderRes = await client.query(
      "UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } });
    }

    const order = orderRes.rows[0];

    // Update payment
    await client.query(
      "UPDATE payments SET status = 'success', provider_ref = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2",
      [razorpay_payment_id, id]
    );

    // Add status history
    await client.query(
      "INSERT INTO order_status_history (order_id, status, note) VALUES ($1, 'paid', 'Payment verified via Razorpay')",
      [id]
    );

    // Notifications
    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1, 'order_confirmed', 'Order Confirmed!', 'Thank you! Your order #' || SUBSTRING($2::text, 1, 8) || ' has been confirmed and is being prepared.', '/orders/' || $2)`,
      [order.user_id, id]
    );

    // Log purchase interactions
    const itemsRes = await client.query('SELECT product_id FROM order_items WHERE order_id = $1', [id]);
    for (const row of itemsRes.rows) {
      await client.query(
        "INSERT INTO user_interactions (user_id, product_id, event_type) VALUES ($1, $2, 'purchase')",
        [order.user_id, row.product_id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment confirmed successfully.',
      data: { order_id: id, status: 'paid' }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
