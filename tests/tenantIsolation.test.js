const request = require('supertest');
const { freshApp } = require('./testApp');

async function registerTenant(app, email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test', email, password: 'password123' });
  return res.body.token;
}

describe('Multi-tenant isolation', () => {
  let app;
  let db;

  beforeEach(async () => {
    ({ app, db } = freshApp());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await db.destroy();
  });

  test('tenant B cannot read, update, or delete tenant A widgets', async () => {
    const tokenA = await registerTenant(app, 'a@example.com');
    const tokenB = await registerTenant(app, 'b@example.com');

    const createRes = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'cta',
        title: "Tenant A's widget",
        fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      });
    expect(createRes.status).toBe(201);
    const widgetId = createRes.body.id;

    // Tenant A can read its own widget.
    const readOwn = await request(app).get(`/api/widgets/${widgetId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(readOwn.status).toBe(200);

    // Tenant B cannot read it — surfaced as 404, not 403, so its existence
    // isn't even confirmed to a tenant that shouldn't know about it.
    const readOther = await request(app).get(`/api/widgets/${widgetId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(readOther.status).toBe(404);

    const updateOther = await request(app)
      .put(`/api/widgets/${widgetId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hijacked' });
    expect(updateOther.status).toBe(404);

    const deleteOther = await request(app)
      .delete(`/api/widgets/${widgetId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteOther.status).toBe(404);

    // Tenant B's own widget list is empty — it never sees tenant A's data.
    const listB = await request(app).get('/api/widgets').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(listB.body).toEqual([]);
  });

  test('requests without a token are rejected with 401', async () => {
    const res = await request(app).get('/api/widgets');
    expect(res.status).toBe(401);
  });

  test('a malformed/expired-looking token is rejected with 401', async () => {
    const res = await request(app).get('/api/widgets').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test("tenant B cannot see tenant A's submissions on the dashboard", async () => {
    const tokenA = await registerTenant(app, 'a2@example.com');
    const tokenB = await registerTenant(app, 'b2@example.com');

    const createRes = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'signup_form',
        title: "Tenant A's widget",
        fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      });
    const widgetId = createRes.body.id;

    await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'lead@example.com' } });

    const overviewA = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(overviewA.body.totalSubmissions).toBe(1);

    const overviewB = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(overviewB.body.totalSubmissions).toBe(0);
  });
});
