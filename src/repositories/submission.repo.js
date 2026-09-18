const db = require('../config/db');
const { newId } = require('../utils/id');

function hydrate(row) {
  if (!row) return row;
  return { ...row, data: row.data ? JSON.parse(row.data) : {} };
}

async function create({ widgetId, tenantId, data, ipAddress, country, city, geoProvider, isSpam }) {
  const id = newId();
  await db('submissions').insert({
    id,
    widget_id: widgetId,
    tenant_id: tenantId,
    data: JSON.stringify(data || {}),
    ip_address: ipAddress || null,
    country: country || null,
    city: city || null,
    geo_provider: geoProvider || null,
    is_spam: !!isSpam,
  });
  return findByIdForTenant(id, tenantId);
}

function findByIdForTenant(id, tenantId) {
  return db('submissions').where({ id, tenant_id: tenantId }).first().then(hydrate);
}

// Paginated list for the dashboard. Always scoped to the authenticated
// tenant; optionally narrowed to one widget (still re-checked against
// tenant_id so a widgetId belonging to another tenant returns nothing).
async function listForTenant(tenantId, { widgetId, page = 1, pageSize = 20 } = {}) {
  const query = db('submissions').where({ tenant_id: tenantId });
  if (widgetId) query.andWhere({ widget_id: widgetId });

  const totalRow = await query.clone().count({ count: '*' }).first();
  const total = Number(totalRow.count);

  const rows = await query
    .clone()
    .orderBy('created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { total, page, pageSize, items: rows.map(hydrate) };
}

async function countForTenant(tenantId) {
  const row = await db('submissions').where({ tenant_id: tenantId }).count({ count: '*' }).first();
  return Number(row.count);
}

async function countTodayForTenant(tenantId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const row = await db('submissions')
    .where({ tenant_id: tenantId })
    .andWhere('created_at', '>=', startOfDay.toISOString())
    .count({ count: '*' })
    .first();
  return Number(row.count);
}

// Per-widget submission counts, for the "which widgets are converting" view.
async function countsByWidgetForTenant(tenantId) {
  return db('submissions')
    .where({ tenant_id: tenantId })
    .select('widget_id')
    .count({ count: '*' })
    .groupBy('widget_id');
}

// Daily bucketed counts for one widget, last N days — deliberately done in
// JS rather than a DB-specific date-trunc function, so the exact same code
// runs unchanged on SQLite and Postgres.
async function dailyCountsForWidget(tenantId, widgetId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await db('submissions')
    .where({ tenant_id: tenantId, widget_id: widgetId })
    .andWhere('created_at', '>=', since.toISOString())
    .select('created_at');

  const buckets = {};
  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    buckets[day] = (buckets[day] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

async function geoBreakdownForWidget(tenantId, widgetId) {
  return db('submissions')
    .where({ tenant_id: tenantId, widget_id: widgetId })
    .whereNotNull('country')
    .select('country')
    .count({ count: '*' })
    .groupBy('country')
    .orderBy('count', 'desc');
}

module.exports = {
  create,
  findByIdForTenant,
  listForTenant,
  countForTenant,
  countTodayForTenant,
  countsByWidgetForTenant,
  dailyCountsForWidget,
  geoBreakdownForWidget,
  newId,
};
