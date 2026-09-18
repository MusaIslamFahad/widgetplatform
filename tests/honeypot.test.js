const request = require('supertest');
const { freshApp } = require('./testApp');
const { seedTenantAndWidget } = require('./helpers');

describe('POST /api/public/submissions — honeypot spam control', () => {
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

  test('a filled honeypot field looks like success but is NOT stored', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'bot@example.com' }, website: 'http://spammer.example' });

    // The bot gets no signal that it was caught.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });

    const count = await db('submissions').where({ widget_id: widgetId }).count({ c: '*' }).first();
    expect(Number(count.c)).toBe(0);
  });

  test('an empty honeypot field is treated as a normal, legitimate submission', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'human@example.com' }, website: '' });

    expect(res.status).toBe(201);

    const count = await db('submissions').where({ widget_id: widgetId }).count({ c: '*' }).first();
    expect(Number(count.c)).toBe(1);
  });

  test('an omitted honeypot field (field not even sent) is also treated as legitimate', async () => {
    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'human2@example.com' } });

    expect(res.status).toBe(201);
  });
});
