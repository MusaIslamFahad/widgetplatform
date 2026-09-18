const env = require('../../../config/env');

/**
 * Deterministic stand-ins for the two real providers, used when
 * GEO_MODE=mock (the default — see .env.example). This is what the
 * capstone brief means by "make the fallback proof deterministic: one
 * mock provider that answers, one you can toggle down": flipping
 * FORCE_PROVIDER_A_DOWN / FORCE_PROVIDER_B_DOWN lets anyone — including an
 * automated evaluator with no internet access — reliably exercise:
 *   - A up            -> enriched by A
 *   - A down, B up     -> enriched by B (the fallback path)
 *   - A down, B down   -> submission still stored, no geo data
 * Switch GEO_MODE=live to hit the real free APIs during manual dev.
 */

async function providerA(ip) {
  if (env.FORCE_PROVIDER_A_DOWN) throw new Error('provider_a_forced_down');
  return { country: 'Bangladesh', city: 'Dhaka', provider: 'mock-provider-a' };
}

async function providerB(ip) {
  if (env.FORCE_PROVIDER_B_DOWN) throw new Error('provider_b_forced_down');
  return { country: 'Bangladesh', city: 'Dhaka (via fallback)', provider: 'mock-provider-b' };
}

module.exports = {
  providerA: { lookup: providerA, name: 'mock-provider-a' },
  providerB: { lookup: providerB, name: 'mock-provider-b' },
};
