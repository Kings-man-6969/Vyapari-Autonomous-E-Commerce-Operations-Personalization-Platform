const jwt = require('jsonwebtoken');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'vyapari_jwt_access_secret_sample_key_change_in_production_384b';

function extractToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required to access this resource.'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired ? 'Session has expired. Please refresh your token.' : 'Invalid authentication token.'
      }
    });
  }
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      req.user = decoded;
    } catch {
      // Ignore invalid token for public/optional endpoints
    }
  }
  next();
}

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please log in to continue.' }
      });
    }

    if (!roles.includes(req.user.role)) {
      try {
        const { query } = require('../config/db');
        const uRes = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (uRes.rows.length > 0 && roles.includes(uRes.rows[0].role)) {
          req.user.role = uRes.rows[0].role;
          return next();
        }
      } catch {
        // Fallback to rejection
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: [${roles.join(', ')}]`
        }
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  JWT_ACCESS_SECRET
};
