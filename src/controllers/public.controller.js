const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const widgetRepo = require('../repositories/widget.repo');
const submissionRepo = require('../repositories/submission.repo');
const idempotencyRepo = require('../repositories/idempotency.repo');
const { submissionSchema } = require('../validation/submission.schema');
const spamCheck = require('../services/spamCheck.service');
const geoService = require('../services/geo/geoService');
const jobQueue = require('../services/jobs.setup');

const WIDGET_BUNDLE_PATH = path.join(__dirname, '..', 'widget-client', `widget.${env.WIDGET_BUNDLE_VERSION}.js`);
const WIDGET_BUNDLE_SOURCE = fs.readFileSync(WIDGET_BUNDLE_PATH, 'utf8');

/**
 * GET /widget.:version.js
 * The one file every customer site loads. The URL is versioned
 * (widget.v1.js, widget.v2.js, ...), so we can cache it *forever* —
 * browsers never need to re-validate, because a content change always
 * means a new URL, never a mutated old one.
 */
function serveBundle(req, res) {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(WIDGET_BUNDLE_SOURCE);
}

/**
 * GET /api/public/widgets/:id/config
 * Small, public, short-lived-cache payload the loader script fetches to
 * know what to render. Short TTL (not "immutable" like the bundle) because
 * unlike the bundle's URL, a widget's config can change without its id
 * changing — an owner editing field labels shouldn't need a new embed
 * snippet, just a fresh config fetch within ~60s.
 */
async function getConfig(req, res) {
  const widget = await widgetRepo.findByIdPublic(req.params.id);
  if (!widget) throw new AppError(404, 'widget_not_found', 'Widget not found');

  res.set('Cache-Control', 'public, max-age=60');
  res.set('ETag', `"${widget.id}-v${widget.version}"`);
  res.json({
    id: widget.id,
    type: widget.type,
    title: widget.title,
    description: widget.description,
    fields: widget.fields,
    buttonText: widget.button_text,
    displayOptions: widget.display_options,
    version: widget.version,
  });
}

/**
 * POST /api/public/submissions
 * The hardened path: this endpoint takes traffic directly from browsers we
 * do not control. Order matters here and mirrors the architecture diagram
 * in README.md:
 *   1. idempotency replay check
 *   2. schema validation            -> clean 4xx, never a 500
 *   3. honeypot spam check          -> silently accept, don't store
 *   4. geo enrichment (best effort) -> never blocks storage
 *   5. store the submission
 *   6. queue the confirmation side effect (fire-and-forget, may fail)
 * (rate limiting already ran as middleware before this handler.)
 */
async function submit(req, res) {
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey) {
    const existing = await idempotencyRepo.find(idempotencyKey);
    if (existing) {
      return res.status(existing.response_snapshot.status).json(existing.response_snapshot.body);
    }
  }

  const { widgetId, data, website } = submissionSchema.parse(req.body);

  const widget = await widgetRepo.findByIdPublic(widgetId);
  if (!widget) throw new AppError(404, 'widget_not_found', 'Widget not found');

  // -- Spam control ------------------------------------------------------
  if (spamCheck.isHoneypotTriggered(website)) {
    // Never tell a bot it was caught: respond exactly like a success, but
    // don't touch the database. PROBE 6 in the brief checks this behaviour.
    return res.status(200).json({ status: 'ok' });
  }

  // -- Enrichment (best-effort, never blocks storage) ---------------------
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const geo = await geoService.enrich(ip);

  // -- Persist -------------------------------------------------------
  const submission = await submissionRepo.create({
    widgetId: widget.id,
    tenantId: widget.tenant_id,
    data,
    ipAddress: ip,
    country: geo.country,
    city: geo.city,
    geoProvider: geo.provider,
    isSpam: false,
  });

  const responseBody = {
    status: 'ok',
    submissionId: submission.id,
    enriched: Boolean(geo.country),
  };

  if (idempotencyKey) {
    await idempotencyRepo.save(idempotencyKey, widget.id, { status: 201, body: responseBody });
  }

  // -- Safe side effect ----------------------------------------------
  // Fire-and-forget: enqueue() returns immediately. If the email job
  // exhausts its retries, jobQueue logs it to failed_jobs — the HTTP
  // response the visitor already received is never affected either way.
  jobQueue.enqueue('send-confirmation-email', {
    submissionId: submission.id,
    widgetId: widget.id,
    data,
  });

  res.status(201).json(responseBody);
}

module.exports = { serveBundle, getConfig, submit };
