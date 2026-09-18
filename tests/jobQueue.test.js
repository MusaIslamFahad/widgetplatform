const request = require('supertest');
const { freshApp } = require('./testApp');
const { seedTenantAndWidget } = require('./helpers');

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('POST /api/public/submissions — safe side effect (confirmation email)', () => {
  let app;
  let db;
  let widgetId;

  afterEach(async () => {
    delete process.env.FORCE_EMAIL_FAILURE;
    if (db) await db.destroy();
  });

  test('the submission still succeeds even when the email side effect fails every attempt', async () => {
    process.env.FORCE_EMAIL_FAILURE = 'true';

    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    const res = await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'resilience-test@example.com' } });

    // The main path is unaffected by the side effect failing.
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');

    const row = await db('submissions').where({ id: res.body.submissionId }).first();
    expect(row).toBeDefined();

    // Let the background job finish retrying before this test's afterEach
    // tears down the db connection — otherwise its last attempt logs a
    // harmless-but-noisy "connection already closed" warning.
    await wait(800);
  });

  test('a side effect that exhausts all retries is logged to failed_jobs as the failure alert', async () => {
    process.env.FORCE_EMAIL_FAILURE = 'true';

    ({ app, db } = freshApp());
    await db.migrate.latest();
    ({ widgetId } = await seedTenantAndWidget(db));

    await request(app)
      .post('/api/public/submissions')
      .send({ widgetId, data: { email: 'resilience-test-2@example.com' } });

    // The job runs off the request path with retries + exponential backoff
    // (see src/services/jobQueue.js) — give it time to exhaust attempts.
    await wait(2000);

    const failedJob = await db('failed_jobs').where({ job_type: 'send-confirmation-email' }).first();
    expect(failedJob).toBeDefined();
    expect(failedJob.attempts).toBe(3);
    expect(failedJob.error).toMatch(/simulated_email_provider_outage/);
  }, 10000);
});
