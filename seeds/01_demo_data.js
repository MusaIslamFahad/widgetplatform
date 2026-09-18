const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Seeds one demo tenant + one demo widget so a stranger cloning the repo
 * can see something working within a minute of `npm run seed`, without
 * having to call the register/widget-create APIs by hand first.
 *
 * Demo login: demo@flyrank.dev / password123
 */
exports.seed = async function seed(knex) {
  await knex('submissions').del();
  await knex('widgets').del();
  await knex('tenants').del();

  const tenantId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash('password123', 10);

  await knex('tenants').insert({
    id: tenantId,
    name: 'Demo Tenant',
    email: 'demo@flyrank.dev',
    password_hash: passwordHash,
  });

  const widgetId = crypto.randomUUID();
  await knex('widgets').insert({
    id: widgetId,
    tenant_id: tenantId,
    type: 'signup_form',
    title: 'Join our newsletter',
    description: 'One email a week, no spam.',
    fields: JSON.stringify([
      { name: 'name', label: 'Your name', type: 'text', required: true },
      { name: 'email', label: 'Email address', type: 'email', required: true },
    ]),
    button_text: 'Subscribe',
    display_options: JSON.stringify({ position: 'inline', theme: 'light' }),
    version: 1,
  });

  // eslint-disable-next-line no-console
  console.log('\nSeed complete.');
  // eslint-disable-next-line no-console
  console.log('  Login:     demo@flyrank.dev / password123');
  // eslint-disable-next-line no-console
  console.log(`  Widget id: ${widgetId}`);
  // eslint-disable-next-line no-console
  console.log(`  Embed:     <script src="http://localhost:3000/widget.v1.js?id=${widgetId}" async></script>\n`);
};
