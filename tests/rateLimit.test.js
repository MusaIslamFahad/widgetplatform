const request = require('supertest');
const { freshApp } = require('./testApp');
const { seedTenantAndWidget } = require('./helpers');

describe('POST /api/public/submissions — rate limiting', () => {
  let app;
  let db;
  let widgetId;

  afterEach(async () => {
    delete process.env.RATE_LIMIT_PER_IP_MAX;
    delete process.env.RATE_LIMIT_PER_IP_WINDOW_MS;
    delete process.env.RATE_LIMIT_PER_WIDGET_MAX;
    delete process.env.RATE_LIMIT_PER_WIDGET_WINDOW_MS;
    if (db) await db.destroy();
  });

  test('a burst over the per-IP limit gets 429s, then a normal request afterwards still succeeds elsewhere', async () => {
    process.env.RATE_LIMIT_PER_IP_MAX = '3';
    process.env.RATE_LIMIT_PER_IP_WINDOW_MS = '60000';

    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/public/submissions')
        .send({ widgetId, data: { email: `burst${i}@example.com` } });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 3)).toEqual([201, 201, 201]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });

  test('a burst over the per-widget limit returns 429 even under the per-IP ceiling', async () => {
    process.env.RATE_LIMIT_PER_IP_MAX = '1000'; // effectively disabled for this test
    process.env.RATE_LIMIT_PER_WIDGET_MAX = '3';
    process.env.RATE_LIMIT_PER_WIDGET_WINDOW_MS = '60000';

    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/public/submissions')
        .send({ widgetId, data: { email: `burst${i}@example.com` } });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 3)).toEqual([201, 201, 201]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});
