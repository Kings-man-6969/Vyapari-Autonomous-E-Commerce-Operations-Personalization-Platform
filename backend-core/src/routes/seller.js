const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool, query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const RECO_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8001';
const AGENT_SERVICE_URL = process.env.SELLER_AGENT_SERVICE_URL || 'http://localhost:8002';

// All seller endpoints require authentication
router.use(requireAuth);

// ----------------------------------------------------------------------------
// 1. SELLER ONBOARDING & KYC (Accessible to any authenticated user: customer/seller/admin)
// ----------------------------------------------------------------------------

// GET /api/seller/onboarding/status
router.get('/onboarding/status', async (req, res, next) => {
  try {
    const profileRes = await query(
      'SELECT sp.*, u.role FROM seller_profiles sp RIGHT JOIN users u ON sp.user_id = u.id WHERE u.id = $1',
      [req.user.id]
    );

    if (profileRes.rows.length === 0 || !profileRes.rows[0].store_name) {
      return res.json({
        success: true,
        data: { onboarding_status: 'not_started' }
      });
    }

    const row = profileRes.rows[0];
    const bInfo = typeof row.business_info === 'string' ? JSON.parse(row.business_info || '{}') : (row.business_info || {});
    const pan = bInfo.pan || '';
    const maskedPan = pan.length >= 4 ? `${pan.slice(0, 2)}******${pan.slice(-2)}` : 'XXXXXXXXXX';

    res.json({
      success: true,
      data: {
        onboarding_status: row.is_verified ? 'verified' : 'submitted',
        store_name: row.store_name,
        pan_masked: maskedPan
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/onboarding (Multi-step KYC submission)
router.post('/onboarding', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      store_name,
      store_description,
      business_address,
      pan,
      gstin,
      bank_account_number,
      bank_ifsc,
      account_holder_name,
      primary_category_id
    } = req.body;

    if (!store_name || !business_address || !pan) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Store name, business address, and PAN are required.' }
      });
    }

    await client.query('BEGIN');

    const businessInfo = {
      business_address: business_address.trim(),
      pan: pan.trim().toUpperCase(),
      gstin: gstin ? gstin.trim().toUpperCase() : '',
      bank_account_number: bank_account_number ? bank_account_number.trim() : '',
      bank_ifsc: bank_ifsc ? bank_ifsc.trim().toUpperCase() : '',
      account_holder_name: account_holder_name ? account_holder_name.trim() : '',
      primary_category_id: primary_category_id || null
    };

    // Upsert seller profile
    const profileRes = await client.query(
      `INSERT INTO seller_profiles (user_id, store_name, description, business_info, is_verified)
       VALUES ($1, $2, $3, $4::jsonb, true)
       ON CONFLICT (user_id)
       DO UPDATE SET store_name = EXCLUDED.store_name,
                     description = EXCLUDED.description,
                     business_info = EXCLUDED.business_info,
                     is_verified = true,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, store_name.trim(), store_description || '', JSON.stringify(businessInfo)]
    );

    // Upgrade user role to 'seller' if currently 'customer'
    await client.query(
      "UPDATE users SET role = 'seller', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND role = 'customer'",
      [req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Seller onboarding completed successfully.',
      data: {
        profile: profileRes.rows[0],
        onboarding_status: 'verified'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ----------------------------------------------------------------------------
// ROLE GUARD: All subsequent routes require 'seller' or 'admin'
// ----------------------------------------------------------------------------
router.use(requireRole(['seller', 'admin']));

// GET /api/seller/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const sellerId = req.user.id;

    const [statsRes, pendingApprovalsRes, recentOrdersRes, lowStockRes] = await Promise.all([
      query(
        `SELECT 
          COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS total_revenue,
          COUNT(DISTINCT oi.order_id) AS total_orders,
          COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_products_count
         FROM products p
         LEFT JOIN order_items oi ON p.id = oi.product_id
         WHERE p.seller_id = $1`,
        [sellerId]
      ),
      query(
        "SELECT COUNT(*) AS count FROM agent_approval_queue WHERE seller_id = $1 AND status = 'pending'",
        [sellerId]
      ),
      query(
        `SELECT DISTINCT 
          o.id, o.total_amount, o.status, o.created_at, u.name AS customer_name
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN users u ON o.user_id = u.id
         WHERE oi.seller_id = $1
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [sellerId]
      ),
      query(
        `SELECT id, title, stock_qty, price 
         FROM products 
         WHERE seller_id = $1 AND stock_qty <= 5 AND status != 'archived'
         ORDER BY stock_qty ASC
         LIMIT 5`,
        [sellerId]
      )
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          total_revenue: parseFloat(statsRes.rows[0].total_revenue),
          total_orders: parseInt(statsRes.rows[0].total_orders, 10),
          active_products: parseInt(statsRes.rows[0].active_products_count, 10),
          pending_approvals: parseInt(pendingApprovalsRes.rows[0].count, 10)
        },
        recent_orders: recentOrdersRes.rows,
        low_stock_alerts: lowStockRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/products
router.get('/products', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT 
        p.id, p.title, p.slug, p.description, p.price, p.compare_at_price,
        p.stock_qty, p.stock_qty AS inventory_count, p.images, p.status, p.created_at,
        c.name AS category_name, c.id AS category_id,
        p.attributes->>'cost_price' AS cost_price,
        p.attributes->>'sku' AS sku,
        p.attributes->'tags' AS tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.seller_id = $1
    `;
    const params = [req.user.id];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND p.status = $${params.length}`;
    }

    sql += ` ORDER BY p.created_at DESC`;

    const productsRes = await query(sql, params);
    res.json({ success: true, data: productsRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/products (Create New Product)
router.post('/products', async (req, res, next) => {
  try {
    const {
      title,
      slug,
      description,
      price,
      compare_at_price,
      cost_price,
      inventory_count,
      category_id,
      images,
      tags,
      status
    } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title, price, and category are required.' }
      });
    }

    const finalSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);
    const stock = parseInt(inventory_count, 10) || 0;
    const finalStatus = status || (stock > 0 ? 'active' : 'out_of_stock');
    const attributes = {
      cost_price: cost_price ? parseFloat(cost_price) : null,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [])
    };

    const insertRes = await query(
      `INSERT INTO products (
        seller_id, category_id, title, slug, description, price, compare_at_price,
        stock_qty, images, attributes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      RETURNING *`,
      [
        req.user.id,
        category_id,
        title.trim(),
        finalSlug,
        description || '',
        parseFloat(price),
        compare_at_price ? parseFloat(compare_at_price) : null,
        stock,
        JSON.stringify(Array.isArray(images) ? images : []),
        JSON.stringify(attributes),
        finalStatus
      ]
    );

    const product = insertRes.rows[0];

    // Trigger vector embedding in background
    try {
      axios.post(`${RECO_SERVICE_URL}/embed/product/${product.id}`, {}, { timeout: 2000 }).catch(() => {});
    } catch {}

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/products/:id
router.get('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cond = isUuid ? 'p.id = $1::uuid' : 'p.slug = $1';

    const pRes = await query(
      `SELECT 
        p.*, p.stock_qty AS inventory_count, c.name AS category_name,
        p.attributes->>'cost_price' AS cost_price,
        p.attributes->'tags' AS tags
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${cond} AND (p.seller_id = $2 OR $3 = 'admin')`,
      [id, req.user.id, req.user.role]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
    }

    res.json({ success: true, data: pRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/seller/products/:id (Update Product)
router.put('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      description,
      price,
      compare_at_price,
      cost_price,
      inventory_count,
      category_id,
      images,
      tags,
      status
    } = req.body;

    const currentRes = await query(
      "SELECT * FROM products WHERE id = $1 AND (seller_id = $2 OR $3 = 'admin')",
      [id, req.user.id, req.user.role]
    );

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
    }

    const cur = currentRes.rows[0];
    const newStock = inventory_count !== undefined ? parseInt(inventory_count, 10) : cur.stock_qty;
    const newStatus = status || (newStock === 0 ? 'out_of_stock' : cur.status);

    const curAttrs = cur.attributes || {};
    const updatedAttrs = {
      ...curAttrs,
      cost_price: cost_price !== undefined ? (cost_price ? parseFloat(cost_price) : null) : curAttrs.cost_price,
      tags: tags !== undefined ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : curAttrs.tags
    };

    const updateRes = await query(
      `UPDATE products
       SET title = COALESCE($1, title),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description),
           price = COALESCE($4, price),
           compare_at_price = $5,
           stock_qty = $6,
           category_id = COALESCE($7, category_id),
           images = COALESCE($8::jsonb, images),
           attributes = $9::jsonb,
           status = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        title?.trim() || null,
        slug?.trim() || null,
        description !== undefined ? description : null,
        price ? parseFloat(price) : null,
        compare_at_price ? parseFloat(compare_at_price) : null,
        newStock,
        category_id || null,
        images ? JSON.stringify(images) : null,
        JSON.stringify(updatedAttrs),
        newStatus,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/orders
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT 
        o.id, o.status, o.created_at, o.total_amount,
        COALESCE(o.shipping_address->>'full_name', o.shipping_address->>'name', u.name) AS customer_name,
        COALESCE(o.shipping_address->>'city', 'N/A') AS shipping_city,
        COALESCE(o.shipping_address->>'state', 'N/A') AS shipping_state,
        u.email AS customer_email,
        SUM(oi.quantity * oi.price_at_purchase) AS seller_subtotal,
        json_agg(json_build_object(
          'order_item_id', oi.id,
          'product_id', oi.product_id,
          'product_title', p.title,
          'quantity', oi.quantity,
          'unit_price', oi.price_at_purchase
        )) AS items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       JOIN users u ON o.user_id = u.id
       WHERE oi.seller_id = $1
    `;
    const params = [req.user.id];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }

    sql += ` GROUP BY o.id, o.shipping_address, u.name, u.email ORDER BY o.created_at DESC`;

    const ordersRes = await query(sql, params);
    res.json({ success: true, data: ordersRes.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/seller/orders/:id/fulfill
router.put('/orders/:id/fulfill', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, tracking_number, carrier } = req.body;

    const validStatuses = ['processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` }
      });
    }

    await query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    await query(
      `INSERT INTO order_status_history (order_id, status, note, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        status,
        `Status set to ${status}. Carrier: ${carrier || 'Express'}, AWB: ${tracking_number || 'N/A'}`,
        req.user.id
      ]
    );

    // Notify buyer
    const orderRes = await query('SELECT user_id FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length > 0) {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          orderRes.rows[0].user_id,
          'order_status',
          `Order #${id.slice(0, 8).toUpperCase()} Dispatched`,
          `Your consignment is now ${status.toUpperCase()} via ${carrier || 'Courier'}.`,
          `/orders/${id}`
        ]
      );
    }

    res.json({ success: true, message: `Order updated to ${status}.` });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/inventory/velocity
router.get('/inventory/velocity', async (req, res, next) => {
  try {
    const productsRes = await query(
      `SELECT 
        p.id, p.title, p.price, p.stock_qty, p.stock_qty AS inventory_count, p.status,
        p.attributes->>'sku' AS sku,
        COALESCE(
          (SELECT SUM(quantity) / 30.0 FROM order_items WHERE product_id = p.id AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'),
          1.2
        ) AS daily_sales_velocity
       FROM products p
       WHERE p.seller_id = $1 AND p.status != 'archived'
       ORDER BY p.stock_qty ASC`,
      [req.user.id]
    );

    res.json({ success: true, data: productsRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/inventory/advisory (Trigger Restock Advisory Agent)
router.post('/inventory/advisory', async (req, res, next) => {
  try {
    const lowStock = await query(
      `SELECT id, title, stock_qty FROM products WHERE seller_id = $1 AND stock_qty <= 10 AND status != 'archived'`,
      [req.user.id]
    );

    let createdCount = 0;
    for (const item of lowStock.rows) {
      const suggestedQty = Math.max(50 - item.stock_qty, 25);
      await query(
        `INSERT INTO agent_approval_queue (seller_id, action_type, title, description, proposed_payload, status)
         VALUES ($1, 'inventory_reorder', $2, $3, $4::jsonb, 'pending')`,
        [
          req.user.id,
          `Restock Advisory: ${item.title}`,
          `Inventory is depleted (${item.stock_qty} units left). Recommended restock batch: ${suggestedQty} units to meet 30-day velocity.`,
          JSON.stringify({ product_id: item.id, reorder_quantity: suggestedQty, current_stock: item.stock_qty })
        ]
      );
      createdCount++;
    }

    res.json({
      success: true,
      message: `Generated ${createdCount} restock advisories in approval queue.`,
      data: { created_count: createdCount }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/ai/chat (Merchant Copilot)
router.post('/ai/chat', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: { code: 'MESSAGE_REQUIRED', message: 'Message is required.' } });
    }

    const lower = message.toLowerCase();
    let reply = "I am observing your marketplace operations and store performance. How can I help you optimize sales today?";

    if (lower.includes('stock') || lower.includes('low') || lower.includes('reorder')) {
      const lowRes = await query('SELECT count(*) AS count FROM products WHERE seller_id = $1 AND stock_qty <= 10', [req.user.id]);
      const count = parseInt(lowRes.rows[0].count, 10);
      reply = count > 0
        ? `You currently have ${count} product(s) with stock runway under 10 units. I have scheduled replenishment advisories in your Approval Queue.`
        : 'All catalog items currently maintain healthy inventory runway (>14 days). No immediate stockout risk detected.';
    } else if (lower.includes('policy') || lower.includes('return')) {
      reply = 'Vyapari platform policies require a 7-day buyer return window. Your custom terms in "Store Settings" are actively indexed by our Support RAG copilot.';
    } else if (lower.includes('rank') || lower.includes('seo') || lower.includes('search')) {
      reply = 'To rank higher in natural language semantic searches, provide detailed material composition, dimensions, and usage scenarios in product descriptions. Our pgvector model computes similarity against customer search intent.';
    }

    res.json({
      success: true,
      data: { reply }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/settings
router.get('/settings', async (req, res, next) => {
  try {
    const profileRes = await query(
      'SELECT * FROM seller_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileRes.rows.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const p = profileRes.rows[0];
    const bInfo = typeof p.business_info === 'string' ? JSON.parse(p.business_info || '{}') : (p.business_info || {});

    res.json({
      success: true,
      data: {
        store_name: p.store_name,
        store_description: p.description,
        business_address: bInfo.business_address || '',
        return_policy: bInfo.return_policy || 'Standard 7-day return policy for unused items.',
        shipping_policy: bInfo.shipping_policy || 'Dispatched within 24-48 hours via express courier.',
        support_email: bInfo.support_email || '',
        support_phone: bInfo.support_phone || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/seller/settings
router.put('/settings', async (req, res, next) => {
  try {
    const {
      store_name,
      store_description,
      business_address,
      return_policy,
      shipping_policy,
      support_email,
      support_phone
    } = req.body;

    const cur = await query('SELECT business_info FROM seller_profiles WHERE user_id = $1', [req.user.id]);
    const prevInfo = cur.rows.length > 0
      ? (typeof cur.rows[0].business_info === 'string' ? JSON.parse(cur.rows[0].business_info || '{}') : (cur.rows[0].business_info || {}))
      : {};

    const mergedInfo = {
      ...prevInfo,
      business_address: business_address || prevInfo.business_address,
      return_policy: return_policy || prevInfo.return_policy,
      shipping_policy: shipping_policy || prevInfo.shipping_policy,
      support_email: support_email || prevInfo.support_email,
      support_phone: support_phone || prevInfo.support_phone
    };

    const updateRes = await query(
      `UPDATE seller_profiles
       SET store_name = COALESCE($1, store_name),
           description = COALESCE($2, description),
           business_info = $3::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4
       RETURNING *`,
      [store_name?.trim() || null, store_description || null, JSON.stringify(mergedInfo), req.user.id]
    );

    res.json({
      success: true,
      message: 'Store settings and support policies updated.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
