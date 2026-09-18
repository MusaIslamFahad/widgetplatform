const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Low rounds — these hashes only ever exist for the lifetime of one test.
const TEST_BCRYPT_ROUNDS = 4;

async function seedTenantAndWidget(db, overrides = {}) {
  const tenantId = crypto.randomUUID();
  await db('tenants').insert({
    id: tenantId,
    name: 'Test Tenant',
    email: `tenant-${tenantId}@example.com`,
    password_hash: await bcrypt.hash('password123', TEST_BCRYPT_ROUNDS),
  });

  const widgetId = crypto.randomUUID();
  await db('widgets').insert({
    id: widgetId,
    tenant_id: tenantId,
    type: 'signup_form',
    title: 'Test Widget',
    fields: JSON.stringify([{ name: 'email', label: 'Email', type: 'email', required: true }]),
    button_text: 'Submit',
    display_options: JSON.stringify({}),
    version: 1,
    ...overrides,
  });

  return { tenantId, widgetId };
}

module.exports = { seedTenantAndWidget };
