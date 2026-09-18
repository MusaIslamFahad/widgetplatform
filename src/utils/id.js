const crypto = require('crypto');

// Node 18+ ships crypto.randomUUID natively — no extra dependency needed,
// and the format is identical whether the row ends up in SQLite or Postgres.
function newId() {
  return crypto.randomUUID();
}

module.exports = { newId };
