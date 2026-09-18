const request = require('supertest');
const { freshApp } = require('./testApp');
const { seedTenantAndWidget } = require('./helpers');

async function submitAndFetchRow({ app, db, widgetId }) {
  const res = await request(app)
    .post('/api/public/submissions')
    .send({ widgetId, data: { email: 'geo-test@example.com' } });
  const row = await db('submissions').where({ id: res.body.submissionId }).first();
  return { res, row };
}

describe('POST /api/public/submissions — geo enrichment fallback chain', () => {
  let app;
  let db;
  let widgetId;

  afterEach(async () => {
    delete process.env.FORCE_PROVIDER_A_DOWN;
    delete process.env.FORCE_PROVIDER_B_DOWN;
    if (db) await db.destroy();
  });

  test('provider A up: submission is enriched by provider A', async () => {
    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    const { res, row } = await submitAndFetchRow({ app, db, widgetId });

    expect(res.body.enriched).toBe(true);
    expect(row.geo_provider).toBe('mock-provider-a');
    expect(row.country).toBeTruthy();
  });

  test('provider A down: falls back to provider B, submission still enriched', async () => {
    process.env.FORCE_PROVIDER_A_DOWN = 'true';

    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    const { res, row } = await submitAndFetchRow({ app, db, widgetId });

    expect(res.body.enriched).toBe(true);
    expect(row.geo_provider).toBe('mock-provider-b');
  });

  test('both providers down: submission still succeeds and is stored, just without geo data', async () => {
    process.env.FORCE_PROVIDER_A_DOWN = 'true';
    process.env.FORCE_PROVIDER_B_DOWN = 'true';

    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    const { res, row } = await submitAndFetchRow({ app, db, widgetId });

    expect(res.status).toBe(201);
    expect(res.body.enriched).toBe(false);
    expect(row).toBeDefined(); // degrade, never fail — the row still exists
    expect(row.geo_provider).toBeNull();
    expect(row.country).toBeNull();
  });
});
