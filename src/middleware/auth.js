const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * `req.tenant = { id, email }`. Every authenticated route (widget CRUD,
 * dashboard) reads the tenant id from here — never from a body/query
 * param — which is what makes cross-tenant access structurally impossible
 * rather than just "checked for".
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'unauthorized', 'Missing or malformed Authorization header'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.tenant = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return next(new AppError(401, 'unauthorized', 'Invalid or expired token'));
  }
}

module.exports = { requireAuth };
