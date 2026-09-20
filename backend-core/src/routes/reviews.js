const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

// ----------------------------------------------------------------------------
// 1. PUBLIC: GET /api/reviews/product/:productId
// Retrieve all reviews and official seller replies for a product
// ----------------------------------------------------------------------------
router.get('/product/:productId', optionalAuth, async (req, res, next) => {
  try {
    const { productId } = req.params;

    const sql = `
      SELECT 
        r.id,
        r.product_id,
        r.rating,
        r.title,
        r.comment,
        r.is_verified_purchase,
        r.seller_reply,
        r.seller_reply_at,
        COALESCE(r.helpful_count, 0) AS helpful_count,
        r.created_at,
        u.id AS reviewer_id,
        u.name AS reviewer_name,
        p.title AS product_title,
        sp.store_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN products p ON r.product_id = p.id
      LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
      WHERE r.product_id = $1::uuid
      ORDER BY r.created_at DESC;
    `;

    const result = await query(sql, [productId]);

    // Calculate rating breakdown & average
    const reviews = result.rows;
    const total = reviews.length;
    let avg = 0;
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    if (total > 0) {
      const sum = reviews.reduce((acc, curr) => {
        if (breakdown[curr.rating] !== undefined) breakdown[curr.rating]++;
        return acc + curr.rating;
      }, 0);
      avg = parseFloat((sum / total).toFixed(1));
    }

    res.json({
      success: true,
      data: {
        total,
        average_rating: avg,
        breakdown,
        reviews
      }
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// 2. CUSTOMER: POST /api/reviews
// Submit or update a review for a product
// ----------------------------------------------------------------------------
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { product_id, rating, title, comment } = req.body;

    if (!product_id || !rating || !comment) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Product ID, rating (1-5), and review comment are required.' }
      });
    }

    const numRating = parseInt(rating, 10);
    if (numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_RATING', message: 'Rating must be an integer between 1 and 5.' }
      });
    }

    // Verify product exists and get seller
    const prodRes = await query('SELECT id, title, seller_id FROM products WHERE id = $1::uuid', [product_id]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' }
      });
    }
    const product = prodRes.rows[0];

    // Check if user has purchased and received this product
    const purchaseCheck = await query(
      `SELECT oi.id, o.id AS order_id
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_id = $1::uuid AND o.user_id = $2::uuid AND o.status = 'delivered'
       LIMIT 1`,
      [product_id, req.user.id]
    );

    const isVerifiedPurchase = purchaseCheck.rows.length > 0;
    const orderId = isVerifiedPurchase ? purchaseCheck.rows[0].order_id : null;

    // Upsert review
    const reviewRes = await query(
      `INSERT INTO reviews (product_id, order_id, user_id, rating, title, comment, is_verified_purchase, created_at)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (product_id, user_id)
       DO UPDATE SET 
         rating = EXCLUDED.rating, 
         title = EXCLUDED.title, 
         comment = EXCLUDED.comment,
         is_verified_purchase = EXCLUDED.is_verified_purchase,
         created_at = CURRENT_TIMESTAMP
       RETURNING *;`,
      [product_id, orderId, req.user.id, numRating, title || '', comment.trim(), isVerifiedPurchase]
    );

    const savedReview = reviewRes.rows[0];

    // Notify seller of new review
    try {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1::uuid, 'customer_review', $2, $3, $4)`,
        [
          product.seller_id,
          `New ${numRating}★ Review on ${product.title}`,
          `${req.user.name || 'A customer'} reviewed "${product.title}": "${comment.slice(0, 100)}..."`,
          `/products/${product.id}`
        ]
      );
    } catch (notifErr) {
      console.warn('[Notification Error]', notifErr.message);
    }

    res.status(201).json({
      success: true,
      data: {
        review: {
          ...savedReview,
          reviewer_name: req.user.name
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// 3. SELLER: POST /api/reviews/:reviewId/reply
// Post or update an official seller reply to a customer review
// ----------------------------------------------------------------------------
router.post('/:reviewId/reply', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Reply text cannot be empty.' }
      });
    }

    // Verify review exists and seller owns the product
    const reviewRes = await query(
      `SELECT r.*, p.title AS product_title, p.seller_id, u.name AS reviewer_name, u.id AS reviewer_id, sp.store_name
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
       WHERE r.id = $1::uuid`,
      [reviewId]
    );

    if (reviewRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Review not found.' }
      });
    }

    const review = reviewRes.rows[0];

    // Authorization: only the product seller or an admin can reply
    if (req.user.role !== 'admin' && review.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only reply to reviews on your own products.' }
      });
    }

    // Save seller reply
    const updateRes = await query(
      `UPDATE reviews 
       SET seller_reply = $1, seller_reply_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid
       RETURNING *;`,
      [reply.trim(), reviewId]
    );

    const updated = updateRes.rows[0];

    // Notify reviewer that seller replied
    try {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1::uuid, 'seller_reply', $2, $3, $4)`,
        [
          review.reviewer_id,
          `${review.store_name || 'Seller'} replied to your review`,
          `Response to your review on ${review.product_title}: "${reply.slice(0, 100)}..."`,
          `/products/${review.product_id}`
        ]
      );
    } catch (notifErr) {
      console.warn('[Notification Error]', notifErr.message);
    }

    res.json({
      success: true,
      data: {
        review_id: reviewId,
        seller_reply: updated.seller_reply,
        seller_reply_at: updated.seller_reply_at,
        store_name: review.store_name
      }
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// 4. SELLER: GET /api/reviews/seller
// Central inbox of all reviews on products belonging to the logged-in seller
// ----------------------------------------------------------------------------
router.get('/seller', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const isSeller = req.user.role === 'seller';
    const params = isSeller ? [req.user.id] : [];
    const filterSql = isSeller ? 'WHERE p.seller_id = $1::uuid' : '';

    const sql = `
      SELECT 
        r.id,
        r.product_id,
        r.rating,
        r.title,
        r.comment,
        r.is_verified_purchase,
        r.seller_reply,
        r.seller_reply_at,
        r.created_at,
        u.name AS reviewer_name,
        p.title AS product_title,
        p.images AS product_images,
        sp.store_name
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
      ${filterSql}
      ORDER BY r.created_at DESC;
    `;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        total: result.rows.length,
        reviews: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// 5. PUBLIC: POST /api/reviews/:reviewId/helpful
// Upvote helpfulness of a customer review
// ----------------------------------------------------------------------------
router.post('/:reviewId/helpful', async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const result = await query(
      `UPDATE reviews 
       SET helpful_count = COALESCE(helpful_count, 0) + 1 
       WHERE id = $1::uuid 
       RETURNING helpful_count;`,
      [reviewId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Review not found.' } });
    }

    res.json({
      success: true,
      data: { helpful_count: result.rows[0].helpful_count }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
