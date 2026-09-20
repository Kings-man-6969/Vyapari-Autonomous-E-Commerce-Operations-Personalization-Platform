const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool, query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const RECO_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://service-recommendation:8001';

router.use(requireAuth);
router.use(requireRole(['seller', 'admin']));

// GET /api/approvals
router.get('/', async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;

    const queueRes = await query(
      `SELECT 
        q.id, q.task_id, q.item_type, q.reference_id, q.risk_level,
        q.payload, q.status, q.seller_edit, q.created_at, q.resolved_at,
        t.task_type
       FROM agent_approval_queue q
       LEFT JOIN agent_tasks t ON q.task_id = t.id
       WHERE q.seller_id = $1 AND ($2 = 'all' OR q.status = $2)
       ORDER BY q.created_at DESC`,
      [req.user.id, status]
    );

    res.json({
      success: true,
      data: { queue: queueRes.rows }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/approvals/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const itemRes = await client.query(
      `SELECT * FROM agent_approval_queue 
       WHERE id = $1 AND seller_id = $2 FOR UPDATE`,
      [id, req.user.id]
    );

    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Queue item not found.' } });
    }

    const item = itemRes.rows[0];
    if (item.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: { code: 'ALREADY_RESOLVED', message: `Item already ${item.status}.` } });
    }

    // 1. If listing_draft, publish to products table
    if (item.item_type === 'listing_draft') {
      const draftRes = await client.query(
        'SELECT * FROM product_drafts WHERE id = $1',
        [item.reference_id]
      );

      if (draftRes.rows.length > 0) {
        const draft = draftRes.rows[0];
        const baseSlug = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
        const price = draft.suggested_price || (item.payload && item.payload.suggested_price) || 1999;

        // Insert into live catalog
        const prodRes = await client.query(
          `INSERT INTO products (
            seller_id, category_id, title, slug, description,
            price, stock_qty, images, attributes, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, 10, $7::jsonb, $8::jsonb, 'active')
           RETURNING id, title, description`,
          [
            draft.seller_id,
            draft.category_id || '10000000-0000-0000-0000-000000000001',
            draft.title,
            slug,
            draft.description,
            price,
            JSON.stringify(draft.source_images || []),
            JSON.stringify({ tags: draft.tags })
          ]
        );

        const published = prodRes.rows[0];

        // Mark draft published
        await client.query(
          "UPDATE product_drafts SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [draft.id]
        );

        // Synchronously trigger pgvector embedding calculation
        try {
          const embRes = await axios.post(
            `${RECO_SERVICE_URL}/embed`,
            { text: `${published.title}. ${published.description}` },
            { timeout: 3000 }
          );
          if (embRes.data && embRes.data.embedding) {
            const vecStr = '[' + embRes.data.embedding.join(',') + ']';
            await client.query(
              `INSERT INTO product_embeddings (product_id, embedding, model_version)
               VALUES ($1, $2::vector, 'all-MiniLM-L6-v2')
               ON CONFLICT (product_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
              [published.id, vecStr]
            );
          }
        } catch (e) {
          console.warn('[Approval Publish Embedding Warning]', e.message);
        }
      }
    } else if (item.item_type === 'support_reply') {
      await client.query(
        'UPDATE support_draft_replies SET auto_sent = true WHERE id = $1',
        [item.reference_id]
      );
    }

    // Update queue status
    await client.query(
      "UPDATE agent_approval_queue SET status = 'approved', resolved_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Item #${id.slice(0, 8)} approved and published successfully.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/approvals/:id/reject
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const updateRes = await query(
      `UPDATE agent_approval_queue 
       SET status = 'rejected', seller_edit = $1::jsonb, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND seller_id = $3 AND status = 'pending'
       RETURNING id`,
      [JSON.stringify({ rejection_reason: reason || 'Rejected by seller' }), id, req.user.id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND_OR_RESOLVED', message: 'Queue item not found or already resolved.' }
      });
    }

    res.json({
      success: true,
      message: 'Agent action rejected.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
