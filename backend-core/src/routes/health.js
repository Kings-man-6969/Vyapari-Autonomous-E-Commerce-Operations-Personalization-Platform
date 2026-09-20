const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const axios = require('axios');

router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  let pgvectorStatus = 'unknown';
  let recoServiceStatus = 'unknown';
  let sellerAgentStatus = 'unknown';

  try {
    const dbRes = await query('SELECT 1 as alive');
    if (dbRes.rows.length > 0) dbStatus = 'healthy';

    const vecRes = await query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
    if (vecRes.rows.length > 0) {
      pgvectorStatus = `enabled (v${vecRes.rows[0].extversion})`;
    } else {
      pgvectorStatus = 'not installed';
    }
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  // Check microservices (timeout after 1.5s)
  const recoUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8001';
  try {
    const r = await axios.get(`${recoUrl}/health`, { timeout: 1500 });
    recoServiceStatus = r.data.status || 'healthy';
  } catch {
    recoServiceStatus = 'offline/unreachable';
  }

  const agentUrl = process.env.SELLER_AGENT_SERVICE_URL || 'http://localhost:8002';
  try {
    const r = await axios.get(`${agentUrl}/health`, { timeout: 1500 });
    sellerAgentStatus = r.data.status || 'healthy';
  } catch {
    sellerAgentStatus = 'offline/unreachable';
  }

  res.json({
    success: true,
    platform: 'Vyapari E-Commerce Operations Platform',
    timestamp: new Date().toISOString(),
    services: {
      backend_core: 'healthy',
      database: dbStatus,
      pgvector: pgvectorStatus,
      recommendation_service: recoServiceStatus,
      seller_agent_service: sellerAgentStatus
    }
  });
});

module.exports = router;
