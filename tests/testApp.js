/**
 * Every test gets a completely fresh module graph: a brand-new in-memory
 * SQLite database, a brand-new rate-limiter store, a brand-new job queue.
 * That's what jest.resetModules() buys us — it's slightly more ceremony
 * than sharing one app across a whole test file, but it means tests can
 * never leak state into each other (a rate-limit test can't poison a
 * validation test that happens to run after it).
 */
function freshApp() {
  jest.resetModules();
  process.env.NODE_ENV = 'test';
  process.env.DB_CLIENT = 'sqlite3';
  process.env.SQLITE_FILE = ':memory:';

  // eslint-disable-next-line global-require
  const createApp = require('../src/app');
  // eslint-disable-next-line global-require
  const db = require('../src/config/db');

  return { app: createApp(), db };
}

module.exports = { freshApp };
