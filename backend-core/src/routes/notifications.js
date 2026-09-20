const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const notifsRes = await query(
      `SELECT id, type, title, body, link, is_read, metadata, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unreadRes = await query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        notifications: notifsRes.rows,
        unread_count: parseInt(unreadRes.rows[0].count, 10)
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res, next) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
