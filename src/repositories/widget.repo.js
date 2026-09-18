const db = require('../config/db');
const { newId } = require('../utils/id');

// -- (de)serialization ------------------------------------------------
// `fields` and `display_options` are stored as JSON text (see migration
// comment). Every row that leaves this module goes through `hydrate` so
// callers always work with real objects, never raw strings.
function hydrate(row) {
  if (!row) return row;
  return {
    ...row,
    fields: row.fields ? JSON.parse(row.fields) : [],
    display_options: row.display_options ? JSON.parse(row.display_options) : {},
  };
}

/**
 * Tenant isolation rule for this whole module: every read or write is
 * scoped by tenant_id, and tenant_id is ALWAYS taken from the trusted
 * caller (the authenticated JWT via req.tenant.id), never from the
 * request body/params. That's what makes "tenant A cannot touch tenant
 * B's widgets" true no matter what a client sends.
 */

async function create(tenantId, { type, title, description, fields, buttonText, displayOptions }) {
  const id = newId();
  await db('widgets').insert({
    id,
    tenant_id: tenantId,
    type,
    title,
    description: description || null,
    fields: JSON.stringify(fields || []),
    button_text: buttonText || 'Submit',
    display_options: JSON.stringify(displayOptions || {}),
    version: 1,
  });
  return findByIdForTenant(id, tenantId);
}

function listForTenant(tenantId) {
  return db('widgets')
    .where({ tenant_id: tenantId })
    .orderBy('created_at', 'desc')
    .then((rows) => rows.map(hydrate));
}

function findByIdForTenant(id, tenantId) {
  return db('widgets').where({ id, tenant_id: tenantId }).first().then(hydrate);
}

// Used ONLY by public, unauthenticated routes (widget.js loader + config
// endpoint). No tenant check here by design — anyone with a widget id may
// fetch its public config, exactly like a Mailchimp/Intercom embed id.
function findByIdPublic(id) {
  return db('widgets').where({ id }).first().then(hydrate);
}

async function updateForTenant(id, tenantId, patch) {
  const existing = await findByIdForTenant(id, tenantId);
  if (!existing) return null;

  const updates = { updated_at: db.fn.now() };
  if (patch.type !== undefined) updates.type = patch.type;
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.buttonText !== undefined) updates.button_text = patch.buttonText;
  if (patch.fields !== undefined) updates.fields = JSON.stringify(patch.fields);
  if (patch.displayOptions !== undefined) updates.display_options = JSON.stringify(patch.displayOptions);
  // Any content change bumps `version`, which changes the config
  // response's ETag and the recommended re-fetch behaviour on the
  // customer's page (see public.controller.js).
  updates.version = existing.version + 1;

  await db('widgets').where({ id, tenant_id: tenantId }).update(updates);
  return findByIdForTenant(id, tenantId);
}

async function deleteForTenant(id, tenantId) {
  const count = await db('widgets').where({ id, tenant_id: tenantId }).del();
  return count > 0;
}

module.exports = {
  create,
  listForTenant,
  findByIdForTenant,
  findByIdPublic,
  updateForTenant,
  deleteForTenant,
};
