const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { requireAuth, requireRole, JWT_ACCESS_SECRET } = require('../src/middleware/auth');

test('Auth Middleware - rejects request without token', () => {
  const req = { headers: {}, cookies: {} };
  let statusSet = null;
  let jsonResponse = null;

  const res = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  requireAuth(req, res, () => {});

  assert.equal(statusSet, 401);
  assert.equal(jsonResponse.success, false);
  assert.equal(jsonResponse.error.code, 'UNAUTHORIZED');
});

test('Auth Middleware - accepts valid Bearer token', () => {
  const payload = { id: 'test-user-id', email: 'test@example.com', role: 'seller', name: 'Test Seller' };
  const token = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '10m' });

  const req = {
    headers: { authorization: `Bearer ${token}` },
    cookies: {}
  };

  let nextCalled = false;
  requireAuth(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 'test-user-id');
  assert.equal(req.user.role, 'seller');
});

test('Role Guard Middleware - restricts unauthorized role', async () => {
  const req = {
    user: { id: 'cust-id', role: 'customer' }
  };

  let statusSet = null;
  let jsonResponse = null;
  const res = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  const guard = requireRole('seller');
  await guard(req, res, () => {});

  assert.equal(statusSet, 403);
  assert.equal(jsonResponse.success, false);
  assert.equal(jsonResponse.error.code, 'FORBIDDEN');
});

test('Role Guard Middleware - permits authorized role', async () => {
  const req = {
    user: { id: 'seller-id', role: 'seller' }
  };

  let nextCalled = false;
  const guard = requireRole(['seller', 'admin']);
  await guard(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
