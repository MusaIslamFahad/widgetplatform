const env = require('../../config/env');
const ipApiProvider = require('./providers/ipApiProvider');
const ipapiCoProvider = require('./providers/ipapiCoProvider');
const mocks = require('./providers/mockProviders');

function getProviderChain() {
  if (env.GEO_MODE === 'live') {
    return [ipApiProvider, ipapiCoProvider];
  }
  return [mocks.providerA, mocks.providerB];
}

/**
 * Try provider A; on ANY failure (network error, timeout, bad response,
 * forced-down flag) fall through to provider B; if both fail, resolve
 * with `null` rather than throwing. Enrichment is a nice-to-have, never a
 * reason to fail a submission — the caller always gets a result object,
 * never an exception, from this function.
 */
async function enrich(ip) {
  const chain = getProviderChain();

  for (const provider of chain) {
    try {
      const result = await provider.lookup(ip);
      return { country: result.country || null, city: result.city || null, provider: result.provider };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[geo] provider "${provider.name}" failed: ${err.message}`);
      // fall through to next provider
    }
  }

  console.warn('[geo] all providers failed — storing submission without geo data');
  return { country: null, city: null, provider: null };
}

module.exports = { enrich };
