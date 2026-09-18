const request = require('supertest');
const { freshApp } = require('./testApp');
const { seedTenantAndWidget } = require('./helpers');

describe('POST /api/public/submissions — idempotency', () => {
  let app;
  let db;
  let widgetId;

  beforeEach(async () => {
    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));
  });

  afterEach(async () => {
    await db.destroy();
  });

  test('retrying the same request with the same Idempotency-Key does not create a second row', async () => {
    const key = 'retry-key-123';
    const payload = { widgetId, data: { email: 'retry@example.com' } };

    const first = await request(app)
      .post('/api/public/submissions')
      .set('Idempotency-Key', key)
      .send(payload);
    const second = await request(app)
      .post('/api/public/submissions')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.submissionId).toBe(first.body.submissionId);

    const count = await db('submissions').where({ widget_id: widgetId }).count({ c: '*' }).first();
    expect(Number(count.c)).toBe(1);
  });

  test('two different Idempotency-Keys create two separate submissions', async () => {
    const payload = { widgetId, data: { email: 'twice@example.com' } };

    await request(app).post('/api/public/submissions').set('Idempotency-Key', 'key-a').send(payload);
    await request(app).post('/api/public/submissions').set('Idempotency-Key', 'key-b').send(payload);

    const count = await db('submissions').where({ widget_id: widgetId }).count({ c: '*' }).first();
    expect(Number(count.c)).toBe(2);
  });

  test('no Idempotency-Key header at all still works normally (it is optional)', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'no-key@example.com' } });
    expect(res.status).toBe(201);
  });
});
