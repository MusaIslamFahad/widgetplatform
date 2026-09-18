const env = require('../../../config/env');

/**
 * Provider B (fallback): ipapi.co — free tier ~1,000 lookups/day, no key,
 * no card. Docs: https://ipapi.co/api/#introduction
 */
async function lookup(ip) {
  if (env.FORCE_PROVIDER_B_DOWN) {
    throw new Error('provider_b_forced_down');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.GEO_TIMEOUT_MS);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ipapi.co responded ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(body.reason || 'ipapi.co lookup failed');
    return { country: body.country_name, city: body.city, provider: 'ipapi.co' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { lookup, name: 'ipapi.co' };
