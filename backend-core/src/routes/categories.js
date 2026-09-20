const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// GET /api/categories
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, slug, parent_id, icon_url, created_at 
       FROM categories 
       ORDER BY parent_id NULLS FIRST, name ASC`
    );

    const all = result.rows;
    const parents = all.filter(c => !c.parent_id);
    const tree = parents.map(parent => ({
      ...parent,
      subcategories: all.filter(c => c.parent_id === parent.id)
    }));

    res.json({
      success: true,
      data: all,
      categories: tree,
      flat: all
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const catRes = await query('SELECT * FROM categories WHERE slug = $1', [req.params.slug]);
    if (catRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' }
      });
    }

    const category = catRes.rows[0];
    const productsRes = await query(
      `SELECT p.id, p.title, p.slug, p.price, p.compare_at_price, p.images, p.stock_qty, p.status, sp.store_name
       FROM products p
       JOIN seller_profiles sp ON p.seller_id = sp.user_id
       WHERE (p.category_id = $1 OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $1))
         AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [category.id]
    );

    res.json({
      success: true,
      data: {
        category,
        products: productsRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
