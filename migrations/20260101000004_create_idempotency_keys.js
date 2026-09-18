/**
 * Supports the optional `Idempotency-Key` header on POST /api/public/submissions.
 * A flaky mobile network or a customer's overzealous "retry on timeout"
 * script can send the exact same submission twice; if the caller attaches
 * the same idempotency key both times, the second call replays the first
 * call's stored response instead of creating a duplicate row.
 */
exports.up = function up(knex) {
  return knex.schema.createTable('idempotency_keys', (table) => {
    table.increments('id').primary();
    table.string('key', 255).notNullable().unique();
    table.string('widget_id', 36).notNullable();
    table.text('response_snapshot').notNullable(); // JSON: { status, body }
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('idempotency_keys');
};
