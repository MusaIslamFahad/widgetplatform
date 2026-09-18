/**
 * `fields` and `display_options` are stored as TEXT/JSON strings rather than
 * a native json/jsonb column. That's a deliberate portability choice: it
 * keeps identical application code working on both SQLite (quick start)
 * and Postgres (docker-compose), since SQLite has no native JSON type.
 * The repository layer is the only place that JSON.parse/stringify these.
 *
 * `version` powers the versioned-bundle cache story: bumping it changes
 * the widget's config ETag/response so the short-lived config cache is
 * invalidated on the next fetch after an edit.
 */
exports.up = function up(knex) {
  return knex.schema.createTable('widgets', (table) => {
    table.string('id', 36).primary();
    table
      .string('tenant_id', 36)
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table.string('type', 32).notNullable(); // signup_form | cta | popover
    table.string('title', 255).notNullable();
    table.text('description');
    table.text('fields').notNullable(); // JSON array, see validation/widget.schema.js
    table.string('button_text', 100).notNullable().defaultTo('Submit');
    table.text('display_options'); // JSON object (position, delay, theme...)
    table.integer('version').notNullable().defaultTo(1);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id'], 'idx_widgets_tenant_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('widgets');
};
