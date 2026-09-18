// Centralised environment configuration.
// Every knob the app reads from process.env is declared here, once, so the
// rest of the codebase never touches process.env directly.
require('dotenv').config();

const asBool = (val, fallback = false) => {
  if (val === undefined || val === '') return fallback;
  return String(val).toLowerCase() === 'true';
};

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // -- Database ---------------------------------------------------------
  // DB_CLIENT lets the same codebase run on zero-setup SQLite (for a quick
  // local start, see README "Quick start") or on real Postgres (the $0
  // Docker path the capstone brief recommends). Knex abstracts the SQL
  // dialect differences; the app code never branches on this value.
  DB_CLIENT: process.env.DB_CLIENT || 'sqlite3',
  SQLITE_FILE: process.env.SQLITE_FILE || './data/dev.sqlite3',
  DATABASE_URL: process.env.DATABASE_URL || '',
  PGHOST: process.env.PGHOST || 'localhost',
  PGPORT: parseInt(process.env.PGPORT || '5432', 10),
  PGUSER: process.env.PGUSER || 'widgetplatform',
  PGPASSWORD: process.env.PGPASSWORD || 'widgetplatform',
  PGDATABASE: process.env.PGDATABASE || 'widgetplatform',

  // -- Auth ---------------------------------------------------------------
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',

  // -- CORS -----------------------------------------------------------
  // Origin allowed to call the authenticated dashboard/admin API.
  // The PUBLIC config/submission endpoints are intentionally open to any
  // origin (that's the whole point of an embeddable widget) and are
  // configured separately in middleware/cors.js.
  ADMIN_ORIGIN: process.env.ADMIN_ORIGIN || '*',

  // -- Rate limiting ----------------------------------------------------
  RATE_LIMIT_PER_IP_WINDOW_MS: parseInt(process.env.RATE_LIMIT_PER_IP_WINDOW_MS || '60000', 10),
  RATE_LIMIT_PER_IP_MAX: parseInt(process.env.RATE_LIMIT_PER_IP_MAX || '20', 10),
  RATE_LIMIT_PER_WIDGET_WINDOW_MS: parseInt(process.env.RATE_LIMIT_PER_WIDGET_WINDOW_MS || '60000', 10),
  RATE_LIMIT_PER_WIDGET_MAX: parseInt(process.env.RATE_LIMIT_PER_WIDGET_MAX || '60', 10),

  // -- Geo enrichment -----------------------------------------------------
  // GEO_MODE=live hits the two real free providers (ip-api.com, ipapi.co).
  // GEO_MODE=mock uses deterministic in-process fakes so the fallback
  // chain can be proven in CI / by an evaluator without depending on the
  // public internet being reachable or the free tiers being up.
  GEO_MODE: process.env.GEO_MODE || 'mock',
  FORCE_PROVIDER_A_DOWN: asBool(process.env.FORCE_PROVIDER_A_DOWN, false),
  FORCE_PROVIDER_B_DOWN: asBool(process.env.FORCE_PROVIDER_B_DOWN, false),
  GEO_TIMEOUT_MS: parseInt(process.env.GEO_TIMEOUT_MS || '3000', 10),

  // -- Side effects -------------------------------------------------------
  FORCE_EMAIL_FAILURE: asBool(process.env.FORCE_EMAIL_FAILURE, false),

  // -- Widget bundle version ----------------------------------------------
  // Bumping this changes the versioned bundle URL (cache-busting) without
  // touching any other code path.
  WIDGET_BUNDLE_VERSION: process.env.WIDGET_BUNDLE_VERSION || 'v1',

  // Used only to build the embed snippet text returned to the dashboard —
  // never used for anything security-relevant. Point it at wherever this
  // API is actually reachable (e.g. http://localhost:3000 in local dev).
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
};

module.exports = env;
