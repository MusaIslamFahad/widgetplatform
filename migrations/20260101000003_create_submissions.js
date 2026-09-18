/**
 * tenant_id is denormalized onto submissions (rather than joined through
 * widgets every time) so the dashboard's tenant-isolation filter is a
 * single indexed WHERE clause on the hottest read path.
 */
exports.up = function up(knex) {
  return knex.schema.createTable('submissions', (table) => {
    table.string('id', 36).primary();
    table
      .string('widget_id', 36)
      .notNullable()
      .references('id')
      .inTable('widgets')
      .onDelete('CASCADE');
    table
      .string('tenant_id', 36)
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table.text('data').notNullable(); // JSON object of submitted field values
    table.string('ip_address', 64);
    table.string('country', 100);
    table.string('city', 100);
    table.string('geo_provider', 32); // 'ip-api' | 'ipapi.co' | null
    table.boolean('is_spam').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id'], 'idx_submissions_tenant_id');
    table.index(['widget_id'], 'idx_submissions_widget_id');
    table.index(['created_at'], 'idx_submissions_created_at');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('submissions');
};
