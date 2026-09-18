# Design Document — Embeddable Widget & Lead-Capture Platform

*Phase 1 deliverable per the capstone brief, Section 8. Written before the
hardened submission path was built, kept here as the record of that
decision — see BUILDLOG.md for what changed during implementation.*

## Problem

Let a customer define a small lead-capture widget (signup form / CTA /
popover) and embed it on any website with a single `<script>` tag. Visitors
on that external site — a domain we don't control, running code we didn't
write — submit the widget, and the submission must travel back to us
validated, spam-filtered, geo-enriched, and stored, without ever trusting
the browser that sent it. The owner then views what came in through a
dashboard.

The core engineering problem isn't CRUD — it's that requests arrive from
the open internet: any origin, any traffic volume, any intent (human or
bot), with upstream dependencies (geo providers, email) that can fail at
any time. The system has to degrade gracefully at every one of those
failure points rather than propagate them into a 500 or a lost submission.

## Data model

Three core tables, tenant-scoped by a `tenant_id` foreign key that every
query filters on:

- **tenants** — a widget-owning account (id, name, email, password_hash).
- **widgets** — belongs to a tenant. `type`, `title`, `fields` (JSON array
  of `{name, label, type, required}`), `button_text`, `display_options`
  (JSON), and a `version` integer that increments on every edit (drives
  cache invalidation for the public config endpoint).
- **submissions** — belongs to a widget, denormalizes `tenant_id` onto the
  row itself so dashboard queries never need a join to enforce isolation.
  Stores the submitted `data` (JSON), the enrichment result (`country`,
  `city`, `geo_provider` — all nullable, since enrichment is best-effort),
  and `ip_address`.

Two supporting tables for the shared cross-cutting requirements:
**idempotency_keys** (dedupes retried submissions) and **failed_jobs** (the
audit trail / failure alert for the background email job).

`fields` and `display_options` are stored as JSON text rather than a native
`json`/`jsonb` column — a deliberate portability choice so the same code
runs unchanged on SQLite (zero-setup local dev) and Postgres (the
docker-compose path), since SQLite has no native JSON type.

## API surface

Three request paths, matching three different trust models — kept
structurally separate (different CORS policy, different auth, different
rate limits) rather than merged into one generic router:

1. **Widget management** (`/api/widgets/*`) — authenticated (JWT), CORS
   restricted to the admin origin. Full CRUD, tenant-isolated.
2. **Widget delivery** (`GET /widget.v1.js`, `GET /api/public/widgets/:id/config`)
   — public, no auth, CORS open to any origin, aggressively cached
   (immutable for the versioned bundle, short-TTL for config).
3. **Public submission** (`POST /api/public/submissions`) — public, no
   auth, CORS open, rate-limited (per-IP and per-widget), the only path
   that touches untrusted browser input.

A fourth, authenticated path (`/api/dashboard/*`) reads aggregated
submission data for the owner.

## Layer sketch

```
routes/        → HTTP verbs + paths only, wires middleware to controllers
controllers/   → request/response shape, calls into services + repositories
services/      → geo enrichment (+ fallback chain), spam check, email,
                 the in-process background job queue
repositories/  → all SQL (via Knex), tenant-isolation enforced here
validation/    → Zod schemas — the only place "is this input well-formed?"
                 is decided
middleware/    → auth, CORS (x2 policies), rate limiting, error handling
```

Request data flows one direction only: routes → controllers → services /
repositories. Repositories never call controllers; services never touch
`req`/`res` directly. This is what makes the submission handler in
`public.controller.js` readable top-to-bottom as the exact sequence in the
architecture diagram in README.md.

## Explicit non-goal

**Multi-instance horizontal scaling is out of scope.** Both the rate
limiter and the background job queue are in-process (an in-memory sliding
window and a `setImmediate`-based queue, respectively — see
`src/middleware/rateLimiters.js` and `src/services/jobQueue.js`). Running
more than one instance of this app behind a load balancer would give each
instance its own independent rate-limit counters and its own job queue,
which would silently weaken both guarantees. Fixing that would mean a
shared store (Redis) for the rate limiter and a real queue (BullMQ+Redis,
SQS) for jobs — both are straightforward swaps given the adapter-shaped
interfaces already in place, but neither is needed to satisfy this
capstone's requirements, and pulling in Redis would break the promised $0,
no-extra-services stack for no benefit at this scale.
