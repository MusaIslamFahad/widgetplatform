const cors = require('cors');
const env = require('../config/env');

/**
 * Two deliberately different CORS policies, because the two APIs have
 * opposite trust models:
 *
 * - adminCors: the dashboard/admin API is called by the tenant's own
 *   frontend (or Postman/tests). Restrict it to a configured origin.
 *
 * - publicCors: the widget config + submission endpoints are called from
 *   ANY customer's website, by design — that's the entire product. `*` is
 *   the correct, intentional choice here, not an oversight. No cookies/
 *   credentials are used on this path (auth-free by design), so `*` is
 *   also safe: there's no session to leak cross-origin.
 */

const adminCors = cors({
  origin: env.ADMIN_ORIGIN === '*' ? true : env.ADMIN_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const publicCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
  // no credentials: true — public endpoints never read/set cookies.
});

module.exports = { adminCors, publicCors };
