/**
 * A tenant is a widget-owning customer account. Every widget and every
 * submission is scoped to a tenant_id — that column is the entire
 * multi-tenant isolation story, enforced in the repository layer (never
 * trust a client-supplied tenant id; it always comes from the JWT).
 */
exports.up = function up(knex) {
  return knex.schema.createTable('tenants', (table) => {
    table.string('id', 36).primary(); // uuid, generated in app code
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('tenants');
};
