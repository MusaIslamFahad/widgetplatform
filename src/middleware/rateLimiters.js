const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

/**
 * Per-IP limiter on the public submission endpoint: a burst from one
 * visitor gets a 429, everyone else keeps working. This is the standard
 * express-rate-limit in-memory store — fine for a single-process $0
 * deployment; swap the `store` option for a Redis store if you ever run
 * more than one instance.
 */
const perIpLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_PER_IP_WINDOW_MS,
  limit: env.RATE_LIMIT_PER_IP_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests from this IP, slow down.' } },
});

/**
 * Per-widget limiter: protects a single popular widget from being flooded
 * by many different IPs at once (which the per-IP limiter above cannot
 * catch on its own). Implemented as a small hand-rolled sliding window
 * because express-rate-limit keys by IP by default; keying by widgetId
 * needs the parsed body, which is available by the time this middleware
 * runs (it's mounted after express.json()).
 */
const widgetHits = new Map(); // widgetId -> array of timestamps (ms)

function perWidgetLimiter(req, res, next) {
  const widgetId = req.body && req.body.widgetId;
  if (!widgetId) return next(); // let validation handle the missing-field case

  const now = Date.now();
  const windowStart = now - env.RATE_LIMIT_PER_WIDGET_WINDOW_MS;
  const hits = (widgetHits.get(widgetId) || []).filter((ts) => ts > windowStart);

  if (hits.length >= env.RATE_LIMIT_PER_WIDGET_MAX) {
    res.set('Retry-After', String(Math.ceil(env.RATE_LIMIT_PER_WIDGET_WINDOW_MS / 1000)));
    return res.status(429).json({
      error: { code: 'rate_limited', message: 'This widget is receiving too many submissions right now.' },
    });
  }

  hits.push(now);
  widgetHits.set(widgetId, hits);
  return next();
}

// Exposed for tests that need a clean slate between cases.
function _resetPerWidgetLimiter() {
  widgetHits.clear();
}

module.exports = { perIpLimiter, perWidgetLimiter, _resetPerWidgetLimiter };
