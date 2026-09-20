const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth, requireRole } = require('../middleware/auth');

const RECO_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://service-recommendation:8001';
const AGENT_SERVICE_URL = process.env.SELLER_AGENT_SERVICE_URL || 'http://service-seller-agent:8002';

// ----------------------------------------------------------------------------
// Public AI Endpoints (Team A: Recommendations & Semantic Search)
// ----------------------------------------------------------------------------

// GET /api/ai/similar/:productId
router.get('/similar/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { limit = 6 } = req.query;
    const response = await axios.get(`${RECO_SERVICE_URL}/similar/${productId}?limit=${limit}`, { timeout: 5000 });
    res.json({ success: true, data: { similar: response.data } });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

// GET /api/ai/popular
router.get('/popular', async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;
    const response = await axios.get(`${RECO_SERVICE_URL}/popular?limit=${limit}`, { timeout: 5000 });
    res.json({ success: true, data: { popular: response.data } });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

// GET /api/ai/search
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit = 12 } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: { code: 'QUERY_REQUIRED', message: 'Search query q is required.' } });
    }
    const response = await axios.get(`${RECO_SERVICE_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`, { timeout: 5000 });
    res.json({ success: true, data: { results: response.data } });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

// ----------------------------------------------------------------------------
// Seller-Protected AI Endpoints (Team B: Agentic Operations)
// ----------------------------------------------------------------------------

// POST /api/ai/generate-listing
router.post('/generate-listing', requireAuth, requireRole(['seller', 'admin']), async (req, res, next) => {
  try {
    const { prompt, category_id, image_urls, notes } = req.body;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: { code: 'PROMPT_REQUIRED', message: 'Product prompt is required for AI generation.' }
      });
    }

    const payload = {
      seller_id: req.user.id,
      prompt,
      category_id,
      image_urls: image_urls || [],
      notes
    };

    const response = await axios.post(`${AGENT_SERVICE_URL}/agents/generate-listing`, payload, { timeout: 30000 });
    res.json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

// POST /api/ai/inventory-advisory
router.post('/inventory-advisory', requireAuth, requireRole(['seller', 'admin']), async (req, res, next) => {
  try {
    const { product_id, current_stock, sales_velocity_7d } = req.body;
    if (!product_id || current_stock === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'product_id and current_stock are required.' }
      });
    }

    const payload = {
      seller_id: req.user.id,
      product_id,
      current_stock: parseInt(current_stock, 10),
      sales_velocity_7d: parseInt(sales_velocity_7d || 5, 10)
    };

    const response = await axios.post(`${AGENT_SERVICE_URL}/agents/inventory-advisory`, payload, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

// POST /api/ai/support-reply
router.post('/support-reply', requireAuth, requireRole(['seller', 'admin']), async (req, res, next) => {
  try {
    const { source_type = 'order_query', source_id, customer_query } = req.body;
    if (!customer_query) {
      return res.status(400).json({
        success: false,
        error: { code: 'QUERY_REQUIRED', message: 'customer_query is required.' }
      });
    }

    const payload = {
      seller_id: req.user.id,
      source_type,
      source_id,
      customer_query
    };

    const response = await axios.post(`${AGENT_SERVICE_URL}/agents/support-reply`, payload, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

module.exports = router;
