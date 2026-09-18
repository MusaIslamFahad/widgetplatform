const env = require('./config/env');
const db = require('./config/db');
const createApp = require('./app');

async function main() {
  // Auto-migrate on boot. For a $0, docker-compose, no-ops-team project
  // this is the right tradeoff: `docker compose up` "just works" on a
  // clean machine, which is exactly what Section 11 of the brief demands
  // ("a stranger can run it"). In a larger production system you'd run
  // migrations as a separate release step instead of on every boot.
  // eslint-disable-next-line no-console
  console.log(`[startup] running migrations (client=${env.DB_CLIENT})...`);
  await db.migrate.latest();
  // eslint-disable-next-line no-console
  console.log('[startup] migrations up to date');

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[startup] listening on http://localhost:${env.PORT} (env=${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[startup] fatal error, exiting:', err);
  process.exit(1);
});
