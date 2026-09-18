const env = require('../../../config/env');

/**
 * Provider A: ip-api.com — free, no API key, 45 requests/minute.
 * Note it's plain HTTP on the free tier (no HTTPS without a paid plan).
 * Docs: https://ip-api.com/docs/api:json
 */
async function lookup(ip) {
  if (env.FORCE_PROVIDER_A_DOWN) {
    throw new Error('provider_a_forced_down');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.GEO_TIMEOUT_MS);
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ip-api.com responded ${res.status}`);
    const body = await res.json();
    if (body.status !== 'success') throw new Error(body.message || 'ip-api.com lookup failed');
    return { country: body.country, city: body.city, provider: 'ip-api.com' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { lookup, name: 'ip-api.com' };
