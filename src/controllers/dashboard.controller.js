const AppError = require('../utils/AppError');
const widgetRepo = require('../repositories/widget.repo');
const submissionRepo = require('../repositories/submission.repo');

async function overview(req, res) {
  const tenantId = req.tenant.id;
  const [total, today, byWidget] = await Promise.all([
    submissionRepo.countForTenant(tenantId),
    submissionRepo.countTodayForTenant(tenantId),
    submissionRepo.countsByWidgetForTenant(tenantId),
  ]);

  res.json({
    totalSubmissions: total,
    submissionsToday: today,
    submissionsByWidget: byWidget.map((row) => ({ widgetId: row.widget_id, count: Number(row.count) })),
  });
}

async function widgetStats(req, res) {
  const tenantId = req.tenant.id;
  const widget = await widgetRepo.findByIdForTenant(req.params.id, tenantId);
  if (!widget) throw new AppError(404, 'widget_not_found', 'Widget not found');

  const [daily, geo] = await Promise.all([
    submissionRepo.dailyCountsForWidget(tenantId, widget.id),
    submissionRepo.geoBreakdownForWidget(tenantId, widget.id),
  ]);

  res.json({
    widgetId: widget.id,
    dailyCounts: daily,
    geoBreakdown: geo.map((row) => ({ country: row.country, count: Number(row.count) })),
  });
}

async function submissions(req, res) {
  const tenantId = req.tenant.id;
  const widgetId = req.query.widgetId || undefined;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);

  const result = await submissionRepo.listForTenant(tenantId, { widgetId, page, pageSize });
  res.json(result);
}

module.exports = { overview, widgetStats, submissions };
