const express = require('express');
const router = express.Router();
const axios = require('axios');
const { query } = require('../config/db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const RECO_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://service-recommendation:8001';

// Helper to generate embedding synchronously via Python microservice
async function syncProductEmbedding(productId, text) {
  try {
    const res = await axios.post(`${RECO_SERVICE_URL}/embed`, { text }, { timeout: 4000 });
    if (res.data && res.data.embedding) {
      const vecStr = '[' + res.data.embedding.join(',') + ']';
      await query(
        `INSERT INTO product_embeddings (product_id, embedding, model_version)
         VALUES ($1, $2::vector, 'all-MiniLM-L6-v2')
         ON CONFLICT (product_id) DO UPDATE 
         SET embedding = EXCLUDED.embedding, updated_at = CURRENT_TIMESTAMP`,
        [productId, vecStr]
      );
    }
  } catch (err) {
    console.warn(`[Embedding Sync Warning] Failed to embed product ${productId}:`, err.message);
  }
}

// GET /api/products/facets
router.get('/facets', async (req, res, next) => {
  try {
    const [brandsRes, priceRes, categoriesRes] = await Promise.all([
      query(`
        SELECT p.attributes->>'brand' AS name, count(1)::int AS count
        FROM products p
        WHERE p.status = 'active' AND p.attributes->>'brand' IS NOT NULL
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 30;
      `),
      query(`
        SELECT 
          MIN(price)::int AS min_price,
          MAX(price)::int AS max_price
        FROM products
        WHERE status = 'active';
      `),
      query(`
        SELECT c.id, c.name, c.slug, count(p.id)::int AS count
        FROM categories c
        JOIN products p ON p.category_id = c.id
        WHERE p.status = 'active'
        GROUP BY c.id
        ORDER BY count DESC;
      `)
    ]);

    res.json({
      success: true,
      data: {
        brands: brandsRes.rows,
        price_limits: priceRes.rows[0] || { min_price: 299, max_price: 199999 },
        categories: categoriesRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// Helper for natural language query interpretation
function parseNaturalLanguageQuery(queryStr, knownBrands = []) {
  if (!queryStr || typeof queryStr !== 'string') return null;
  let text = queryStr.trim();
  const intent = {};

  // 1. Price extraction (under / below / above / between)
  const betweenMatch = text.match(/\b(?:between)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\s*(?:and|to|-)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\b/i);
  if (betweenMatch) {
    const parseVal = (str) => {
      let r = str.toLowerCase().replace(/,/g, '');
      return r.endsWith('k') ? parseFloat(r) * 1000 : parseFloat(r);
    };
    intent.min_price = parseVal(betweenMatch[1]);
    intent.max_price = parseVal(betweenMatch[2]);
    text = text.replace(betweenMatch[0], ' ');
  } else {
    const underMatch = text.match(/\b(?:under|below|less than|within|max|up to)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\b/i);
    if (underMatch) {
      let raw = underMatch[1].toLowerCase().replace(/,/g, '');
      let val = raw.endsWith('k') ? parseFloat(raw) * 1000 : parseFloat(raw);
      if (!isNaN(val)) intent.max_price = val;
      text = text.replace(underMatch[0], ' ');
    }

    const aboveMatch = text.match(/\b(?:above|over|more than|min|starting from)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\b/i);
    if (aboveMatch) {
      let raw = aboveMatch[1].toLowerCase().replace(/,/g, '');
      let val = raw.endsWith('k') ? parseFloat(raw) * 1000 : parseFloat(raw);
      if (!isNaN(val)) intent.min_price = val;
      text = text.replace(aboveMatch[0], ' ');
    }
  }

  // 2. Rating extraction
  if (/\b(?:best|top rated|highest rated|top quality|premium|5 star)\b/i.test(text)) {
    intent.min_rating = 4.0;
    intent.sort = 'rating_desc';
    text = text.replace(/\b(?:best|top rated|highest rated|top quality|premium|5 star)\b/gi, ' ');
  }

  // 3. Delivery speed
  if (/\b(?:fast delivery|next day|tomorrow|quick delivery|free 2-day)\b/i.test(text)) {
    intent.fast_delivery = true;
    text = text.replace(/\b(?:fast delivery|next day|tomorrow|quick delivery|free 2-day)\b/gi, ' ');
  }

  // 4. Value / Budget
  if (/\b(?:cheap|budget|affordable|low price|deal|discounted)\b/i.test(text)) {
    intent.is_budget = true;
    if (!intent.sort) intent.sort = 'price_asc';
    text = text.replace(/\b(?:cheap|budget|affordable|low price|deal|discounted)\b/gi, ' ');
  }

  // 5. Brand detection
  for (const b of knownBrands) {
    if (!b) continue;
    const regex = new RegExp(`\\b${b.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      intent.brand = b;
      text = text.replace(regex, ' ');
      break;
    }
  }

  // Clean trailing prepositions & excess spaces
  let cleanQuery = text.replace(/\s+/g, ' ').trim();
  cleanQuery = cleanQuery.replace(/\b(with|for|in|of|and|an|a|the)\b$/i, '').trim();

  return {
    original: queryStr,
    cleanQuery: cleanQuery || queryStr,
    intent,
    hasIntent: Object.keys(intent).length > 0
  };
}

// GET /api/products/suggest
router.get('/suggest', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: { products: [], brands: [], categories: [], suggestions: [] } });
    }

    const term = q.trim();
    const termLike = `%${term}%`;
    const startLike = `${term}%`;

    const [prodsRes, brandsRes, catsRes] = await Promise.all([
      query(`
        SELECT 
          p.id, p.title, p.price, p.compare_at_price, p.images,
          p.attributes->>'brand' AS brand,
          COALESCE((p.attributes->>'rating')::numeric, 4.5) AS rating,
          c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active'
          AND (p.title ILIKE $1 OR p.attributes->>'brand' ILIKE $1 OR c.name ILIKE $1)
        ORDER BY 
          CASE 
            WHEN p.attributes->>'brand' ILIKE $2 THEN 1 
            WHEN p.title ILIKE $2 THEN 2 
            ELSE 3 
          END,
          p.price ASC
        LIMIT 4;
      `, [termLike, startLike]),
      query(`
        SELECT p.attributes->>'brand' AS name, count(1)::int AS count
        FROM products p
        WHERE p.status = 'active' AND p.attributes->>'brand' ILIKE $1
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 3;
      `, [termLike]),
      query(`
        SELECT c.id, c.name, c.slug, count(p.id)::int AS count
        FROM categories c
        JOIN products p ON p.category_id = c.id
        WHERE p.status = 'active' AND c.name ILIKE $1
        GROUP BY c.id
        ORDER BY count DESC
        LIMIT 3;
      `, [termLike])
    ]);

    // Build smart search suggestions
    const suggestions = [];
    if (brandsRes.rows.length > 0 && catsRes.rows.length > 0) {
      suggestions.push(`${brandsRes.rows[0].name} in ${catsRes.rows[0].name}`);
    }
    prodsRes.rows.forEach(p => {
      if (suggestions.length < 4 && !suggestions.includes(p.title)) {
        suggestions.push(p.title);
      }
    });

    res.json({
      success: true,
      data: {
        query: term,
        products: prodsRes.rows,
        brands: brandsRes.rows,
        categories: catsRes.rows,
        suggestions
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const {
      category_id,
      seller_id,
      min_price,
      max_price,
      brand,
      min_rating,
      min_discount,
      fast_delivery,
      sort,
      page = 1,
      limit = 24,
      q
    } = req.query;

    let effectiveMinPrice = min_price ? parseFloat(min_price) : null;
    let effectiveMaxPrice = max_price ? parseFloat(max_price) : null;
    let effectiveBrand = brand || null;
    let effectiveMinRating = min_rating ? parseFloat(min_rating) : null;
    let effectiveFastDelivery = (fast_delivery === 'true' || fast_delivery === true);
    let effectiveSort = sort || 'newest';

    // 1. Natural Language Query Analysis & Semantic Vector Search
    let nlAnalysis = null;
    let semanticProductIds = [];

    if (q && q.trim()) {
      const brandsCacheRes = await query(`
        SELECT DISTINCT attributes->>'brand' as brand 
        FROM products 
        WHERE status = 'active' AND attributes->>'brand' IS NOT NULL;
      `);
      const knownBrands = brandsCacheRes.rows.map(r => r.brand).filter(Boolean);

      nlAnalysis = parseNaturalLanguageQuery(q, knownBrands);

      // Inferred parameter fallback if not explicitly passed by user
      if (effectiveMinPrice === null && nlAnalysis.intent.min_price) {
        effectiveMinPrice = nlAnalysis.intent.min_price;
      }
      if (effectiveMaxPrice === null && nlAnalysis.intent.max_price) {
        effectiveMaxPrice = nlAnalysis.intent.max_price;
      }
      if (!effectiveBrand && nlAnalysis.intent.brand) {
        effectiveBrand = nlAnalysis.intent.brand;
      }
      if (effectiveMinRating === null && nlAnalysis.intent.min_rating) {
        effectiveMinRating = nlAnalysis.intent.min_rating;
      }
      if (!effectiveFastDelivery && nlAnalysis.intent.fast_delivery) {
        effectiveFastDelivery = true;
      }
      if (!sort && nlAnalysis.intent.sort) {
        effectiveSort = nlAnalysis.intent.sort;
      }

      // Query recommendation service for semantic vector matches
      const cleanQ = nlAnalysis.cleanQuery || q;
      try {
        const recoRes = await axios.get(`${RECO_SERVICE_URL}/search?q=${encodeURIComponent(cleanQ)}&limit=36`, { timeout: 3000 });
        if (Array.isArray(recoRes.data)) {
          semanticProductIds = recoRes.data.filter(r => r.similarity >= 0.32).map(r => r.id);
        }
      } catch (err) {
        console.warn('[Semantic Search Fallback]:', err.message);
      }
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = ["p.status = 'active'"];
    const params = [];

    if (category_id) {
      params.push(category_id);
      conditions.push(`(p.category_id = $${params.length} OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $${params.length}))`);
    }

    if (seller_id) {
      params.push(seller_id);
      conditions.push(`p.seller_id = $${params.length}`);
    }

    if (effectiveMinPrice !== null) {
      params.push(effectiveMinPrice);
      conditions.push(`p.price >= $${params.length}`);
    }

    if (effectiveMaxPrice !== null) {
      params.push(effectiveMaxPrice);
      conditions.push(`p.price <= $${params.length}`);
    }

    if (effectiveBrand) {
      const brandList = effectiveBrand.split(',').map(b => b.trim()).filter(Boolean);
      if (brandList.length === 1) {
        params.push(brandList[0]);
        conditions.push(`p.attributes->>'brand' ILIKE $${params.length}`);
      } else if (brandList.length > 1) {
        params.push(brandList);
        conditions.push(`p.attributes->>'brand' = ANY($${params.length})`);
      }
    }

    if (effectiveMinRating !== null) {
      params.push(effectiveMinRating);
      conditions.push(`COALESCE((p.attributes->>'rating')::numeric, sp.rating_avg, 0) >= $${params.length}`);
    }

    if (min_discount) {
      params.push(parseFloat(min_discount));
      conditions.push(`p.compare_at_price IS NOT NULL AND ((p.compare_at_price - p.price) / p.compare_at_price * 100) >= $${params.length}`);
    }

    if (effectiveFastDelivery) {
      conditions.push(`(p.attributes->>'fast_delivery' ILIKE '%Tomorrow%' OR p.price >= 999)`);
    }

    // Hybrid Match (Semantic Vector Matches OR Keyword Words)
    if (q && q.trim()) {
      if (semanticProductIds.length > 0) {
        params.push(semanticProductIds);
        const vectorParam = `$${params.length}`;
        const words = (nlAnalysis?.cleanQuery || q).split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          const textConds = words.map(w => {
            params.push(`%${w}%`);
            return `(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
          });
          conditions.push(`(p.id = ANY(${vectorParam}) OR (${textConds.join(' AND ')}))`);
        } else {
          conditions.push(`p.id = ANY(${vectorParam})`);
        }
      } else {
        const words = (nlAnalysis?.cleanQuery || q).split(/\s+/).filter(w => w.length > 2);
        if (words.length > 1) {
          const textConds = words.map(w => {
            params.push(`%${w}%`);
            return `(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
          });
          conditions.push(`(${textConds.join(' AND ')})`);
        } else {
          params.push(`%${q.trim()}%`);
          conditions.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
        }
      }
    }

    let orderBy = 'p.created_at DESC';
    if (semanticProductIds.length > 0 && !sort) {
      const vecIdx = params.indexOf(semanticProductIds) + 1;
      orderBy = `array_position($${vecIdx}, p.id) ASC, p.created_at DESC`;
    } else if (effectiveSort === 'price_asc') {
      orderBy = 'p.price ASC';
    } else if (effectiveSort === 'price_desc') {
      orderBy = 'p.price DESC';
    } else if (effectiveSort === 'rating_desc') {
      orderBy = "COALESCE((p.attributes->>'rating')::numeric, sp.rating_avg, 0) DESC";
    }

    const whereClause = conditions.join(' AND ');

    params.push(parseInt(limit, 10));
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT 
        p.id, p.seller_id, p.category_id, p.title, p.slug, p.description,
        p.price, p.compare_at_price, p.stock_qty, p.images, p.attributes, p.status, p.created_at,
        c.name AS category_name, c.slug AS category_slug,
        sp.store_name, sp.rating_avg AS seller_rating
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `;

    const countSql = `SELECT COUNT(*) AS total FROM products p WHERE ${whereClause};`;
    const [dataRes, countRes] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        products: dataRes.rows,
        pagination: {
          total: parseInt(countRes.rows[0].total, 10),
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(parseInt(countRes.rows[0].total, 10) / parseInt(limit, 10))
        },
        nl_analysis: (nlAnalysis && nlAnalysis.hasIntent) ? {
          is_natural_language: true,
          original_query: nlAnalysis.original,
          clean_query: nlAnalysis.cleanQuery,
          applied_intent: {
            max_price: effectiveMaxPrice,
            min_price: effectiveMinPrice,
            brand: effectiveBrand,
            min_rating: effectiveMinRating,
            fast_delivery: effectiveFastDelivery
          }
        } : null
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereCondition = isUuid ? 'p.id = $1::uuid' : 'p.slug = $1';

    const productRes = await query(
      `SELECT 
        p.*,
        c.name AS category_name, c.slug AS category_slug,
        sp.store_name, sp.description AS store_description, sp.rating_avg AS store_rating, sp.is_verified
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
       WHERE ${whereCondition}`,
      [id]
    );

    if (productRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' }
      });
    }

    const product = productRes.rows[0];

    // Fetch reviews
    const reviewsRes = await query(
      `SELECT r.id, r.rating, r.title, r.comment, r.created_at, r.is_verified_purchase, u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [product.id]
    );

    // Interaction Logging: logged ONLY after query succeeds per contract
    if (req.user) {
      query(
        `INSERT INTO user_interactions (user_id, product_id, event_type)
         VALUES ($1, $2, 'view')`,
        [req.user.id, product.id]
      ).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        product,
        reviews: reviewsRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/products (Seller only)
router.post('/', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const {
      title,
      description,
      price,
      compare_at_price,
      stock_qty = 0,
      category_id,
      images = [],
      attributes = {},
      status = 'active'
    } = req.body;

    if (!title || !description || price === undefined || !category_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title, description, price, and category_id are required.' }
      });
    }

    // Generate unique slug
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    const effectiveStatus = parseInt(stock_qty, 10) === 0 ? 'out_of_stock' : status;

    const insertRes = await query(
      `INSERT INTO products (
        seller_id, category_id, title, slug, description, 
        price, compare_at_price, stock_qty, images, attributes, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
       RETURNING *`,
      [
        req.user.id,
        category_id,
        title.trim(),
        slug,
        description,
        parseFloat(price),
        compare_at_price ? parseFloat(compare_at_price) : null,
        parseInt(stock_qty, 10),
        JSON.stringify(images),
        JSON.stringify(attributes),
        effectiveStatus
      ]
    );

    const newProduct = insertRes.rows[0];

    // Synchronous embedding generation per architectural decision A4
    const textToEmbed = `${newProduct.title}. ${newProduct.description}`;
    await syncProductEmbedding(newProduct.id, textToEmbed);

    res.status(201).json({
      success: true,
      data: { product: newProduct }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id (Seller only, with ownership guard)
router.put('/:id', requireAuth, requireRole(['seller', 'admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' }
      });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only edit products belonging to your store.' }
      });
    }

    const {
      title = current.title,
      description = current.description,
      price = current.price,
      compare_at_price = current.compare_at_price,
      stock_qty = current.stock_qty,
      category_id = current.category_id,
      images = current.images,
      attributes = current.attributes,
      status = current.status
    } = req.body;

    const effectiveStatus = parseInt(stock_qty, 10) === 0 && status === 'active' ? 'out_of_stock' : status;

    const updateRes = await query(
      `UPDATE products 
       SET title = $1, description = $2, price = $3, compare_at_price = $4,
           stock_qty = $5, category_id = $6, images = $7::jsonb, 
           attributes = $8::jsonb, status = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        title.trim(),
        description,
        parseFloat(price),
        compare_at_price ? parseFloat(compare_at_price) : null,
        parseInt(stock_qty, 10),
        category_id,
        JSON.stringify(images),
        JSON.stringify(attributes),
        effectiveStatus,
        id
      ]
    );

    const updated = updateRes.rows[0];

    // Refresh embedding on update
    syncProductEmbedding(updated.id, `${updated.title}. ${updated.description}`).catch(() => {});

    res.json({
      success: true,
      data: { product: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/reviews (Verified Purchase Gate)
router.post('/reviews', requireAuth, async (req, res, next) => {
  try {
    const { product_id, order_id, rating, title, comment } = req.body;
    if (!product_id || !rating || !comment) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'product_id, rating (1-5), and comment are required.' }
      });
    }

    // Purchase gate: verify customer has received a delivered order containing this product
    const purchaseCheck = await query(
      `SELECT oi.id 
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_id = $1 AND o.user_id = $2 AND o.status = 'delivered'`,
      [product_id, req.user.id]
    );

    const isVerifiedPurchase = purchaseCheck.rows.length > 0;

    const reviewRes = await query(
      `INSERT INTO reviews (product_id, order_id, user_id, rating, title, comment, is_verified_purchase)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (product_id, user_id) 
       DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [product_id, order_id || null, req.user.id, parseInt(rating, 10), title || '', comment.trim(), isVerifiedPurchase]
    );

    res.status(201).json({
      success: true,
      data: { review: reviewRes.rows[0] }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
