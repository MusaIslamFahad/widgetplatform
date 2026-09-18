const env = require('../config/env');
const AppError = require('../utils/AppError');
const widgetRepo = require('../repositories/widget.repo');
const { createWidgetSchema, updateWidgetSchema } = require('../validation/widget.schema');

function buildEmbedSnippet(widget) {
  const src = `${env.PUBLIC_BASE_URL}/widget.${env.WIDGET_BUNDLE_VERSION}.js?id=${widget.id}`;
  return `<script src="${src}" async></script>`;
}

function serialize(widget) {
  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    description: widget.description,
    fields: widget.fields,
    buttonText: widget.button_text,
    displayOptions: widget.display_options,
    version: widget.version,
    createdAt: widget.created_at,
    updatedAt: widget.updated_at,
    embedSnippet: buildEmbedSnippet(widget),
  };
}

async function create(req, res) {
  const input = createWidgetSchema.parse(req.body);
  const widget = await widgetRepo.create(req.tenant.id, input);
  res.status(201).json(serialize(widget));
}

async function list(req, res) {
  const widgets = await widgetRepo.listForTenant(req.tenant.id);
  res.json(widgets.map(serialize));
}

async function getOne(req, res) {
  const widget = await widgetRepo.findByIdForTenant(req.params.id, req.tenant.id);
  if (!widget) throw new AppError(404, 'widget_not_found', 'Widget not found');
  res.json(serialize(widget));
}

async function update(req, res) {
  const input = updateWidgetSchema.parse(req.body);
  const widget = await widgetRepo.updateForTenant(req.params.id, req.tenant.id, input);
  if (!widget) throw new AppError(404, 'widget_not_found', 'Widget not found');
  res.json(serialize(widget));
}

async function remove(req, res) {
  const deleted = await widgetRepo.deleteForTenant(req.params.id, req.tenant.id);
  if (!deleted) throw new AppError(404, 'widget_not_found', 'Widget not found');
  res.status(204).send();
}

async function embedSnippet(req, res) {
  const widget = await widgetRepo.findByIdForTenant(req.params.id, req.tenant.id);
  if (!widget) throw new AppError(404, 'widget_not_found', 'Widget not found');
  res.json({ snippet: buildEmbedSnippet(widget) });
}

module.exports = { create, list, getOne, update, remove, embedSnippet, serialize, buildEmbedSnippet };
