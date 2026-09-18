const db = require('../config/db');

async function find(key) {
  const row = await db('idempotency_keys').where({ key }).first();
  if (!row) return null;
  return { ...row, response_snapshot: JSON.parse(row.response_snapshot) };
}

async function save(key, widgetId, responseSnapshot) {
  try {
    await db('idempotency_keys').insert({
      key,
      widget_id: widgetId,
      response_snapshot: JSON.stringify(responseSnapshot),
    });
  } catch (err) {
    // Unique constraint race (two near-simultaneous retries) — harmless,
    // whichever write won is the one future lookups will see.
    if (!/unique/i.test(err.message)) throw err;
  }
}

module.exports = { find, save };
