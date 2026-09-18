const request = require('supertest');
const { freshApp } = require('./testApp');
const { seedTenantAndWidget } = require('./helpers');

describe('POST /api/public/submissions — validation', () => {
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

  test('missing widgetId returns a clean 400, never a 500', async () => {
    const res = await request(app).post('/api/public/submissions').send({ data: { email: 'a@b.com' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  test('missing data object returns a clean 400', async () => {
    const res = await request(app).post('/api/public/submissions').send({ widgetId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  test('submitting to an unknown widget id returns 404, not 500', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId: 'does-not-exist', data: { email: 'a@b.com' } });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('widget_not_found');
  });

  test('malformed JSON body returns 400, not 500', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('malformed_json');
  });

  test('a body over the size limit returns 413, not 500', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'a'.repeat(200000) } });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  test('a valid submission is accepted and stored', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'ada@example.com' } });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.submissionId).toBeDefined();

    const row = await db('submissions').where({ id: res.body.submissionId }).first();
    expect(row).toBeDefined();
    expect(JSON.parse(row.data)).toEqual({ email: 'ada@example.com' });
  });
});
