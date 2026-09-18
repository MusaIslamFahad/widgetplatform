const path = require('path');
const fs = require('fs');
const env = require('./src/config/env');

// One shared shape, two possible clients. This is the only file that knows
// about the sqlite/postgres split — everything else talks to db via
// src/config/db.js and plain knex query methods that work on both.
function buildConnection() {
  if (env.DB_CLIENT === 'pg') {
    if (env.DATABASE_URL) return env.DATABASE_URL;
    return {
      host: env.PGHOST,
      port: env.PGPORT,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      database: env.PGDATABASE,
    };
  }
  // sqlite3 fallback — zero external services, good for `npm run dev`.
  // ':memory:' is a special SQLite identifier, not a real path — passing it
  // through path.resolve() would turn it into a literal (wrong) file path,
  // so it's left untouched. Tests use ':memory:' for full isolation.
  if (env.SQLITE_FILE === ':memory:') return { filename: ':memory:' };

  const resolved = path.resolve(__dirname, env.SQLITE_FILE);
  // `data/` is git-ignored (see .gitignore) so it does not exist on a fresh
  // clone. better-sqlite3 refuses to create a db file inside a missing
  // directory, which would otherwise break "a stranger can run it on a
  // clean machine" (Section 11) on the very first `npm run migrate`.
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return { filename: resolved };
}

const config = {
  client: env.DB_CLIENT === 'pg' ? 'pg' : 'better-sqlite3',
  connection: buildConnection(),
  useNullAsDefault: env.DB_CLIENT !== 'pg',
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
  },
  seeds: {
    directory: path.resolve(__dirname, 'seeds'),
  },
  pool:
    env.DB_CLIENT === 'pg'
      ? { min: 2, max: 10 }
      : {
          min: 1,
          max: 1,
          // sqlite has no real concurrent-connection story; enforce FKs per-connection.
          afterCreate: (conn, done) => {
            conn.pragma('foreign_keys = ON');
            done();
          },
        },
};

module.exports = config;
