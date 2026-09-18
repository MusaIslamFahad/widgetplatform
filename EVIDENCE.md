# Evidence

Every entry below is real output, captured by actually running this
repository (SQLite quick-start mode) — not written from assumption. A
handful of items are marked `TODO (fill in yourself)` where the proof needs
your own running instance or a browser (see `BUILDLOG.md`).

## Widget management

**Authenticated CRUD; unauthenticated requests rejected.**
```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/widgets
401
```

**Multi-tenant isolation** — two tenants registered, tenant A creates a
widget, tenant B is refused access to it (Jest, real HTTP requests):
```
PASS tests/tenantIsolation.test.js
  Multi-tenant isolation
    ✓ tenant B cannot read, update, or delete tenant A widgets (332 ms)
    ✓ requests without a token are rejected with 401 (192 ms)
    ✓ a malformed/expired-looking token is rejected with 401 (112 ms)
    ✓ tenant B cannot see tenant A's submissions on the dashboard (296 ms)
```

## Widget delivery

**Embed snippet generated per widget** — from a real seed run:
```
Widget id: 7032a71f-4ce5-404c-8b05-2c67b16aae4c
Embed:     <script src="http://localhost:3000/widget.v1.js?id=7032a71f-4ce5-404c-8b05-2c67b16aae4c" async></script>
```

**Public config endpoint, correct cache headers:**
```
$ curl -s -I http://localhost:3000/api/public/widgets/7032a71f.../config
HTTP/1.1 200 OK
Cache-Control: public, max-age=60
ETag: "7032a71f-4ce5-404c-8b05-2c67b16aae4c-v1"
```

**Versioned bundle, correct cache headers:**
```
$ curl -s -I http://localhost:3000/widget.v1.js
HTTP/1.1 200 OK
Content-Type: application/javascript; charset=utf-8
Cache-Control: public, max-age=31536000, immutable
```

**Widget renders on a page served from a different origin than the API:**
`TODO (fill in yourself)` — run `npm run test-site`, open
`http://localhost:5500/index.html?widgetId=<id>`, and confirm the form
renders and submits (open devtools Network tab to see the cross-origin
`OPTIONS` preflight + `POST`, both succeeding). Screenshot or note the
result here.

## Public submission API

**Cross-origin submission succeeds (PROBE 1):**
```
$ curl -s -i -X POST http://localhost:3000/api/public/submissions \
    -H "Content-Type: application/json" -H "Origin: http://localhost:5500" \
    -d '{"widgetId":"7032a71f-...","data":{"name":"Ada Lovelace","email":"ada@example.com"}}'
HTTP/1.1 201 Created
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8

{"status":"ok","submissionId":"6b42f104-9e84-4c9d-9d37-a06e6049ebd1","enriched":true}
```

**CORS preflight handled:**
```
$ curl -s -i -X OPTIONS http://localhost:3000/api/public/submissions \
    -H "Origin: http://localhost:5500" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type"
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Methods: GET,POST,OPTIONS
```

**Malformed / oversized payloads rejected with clean 4xx (PROBE 2):**
```
$ curl -s -i -X POST .../submissions -d '{"data":{"name":"x"}}'   # missing widgetId
HTTP/1.1 400 Bad Request
{"error":{"code":"validation_failed","message":"Request payload failed validation",
  "details":[{"path":"widgetId","message":"Required"}]}}

$ curl -s -i -X POST .../submissions --data-binary @big_200kb_payload.json
HTTP/1.1 413 Payload Too Large
{"error":{"code":"payload_too_large","message":"Request body exceeds the allowed size."}}
```
Also covered by Jest (`tests/validation.test.js`, 6/6 passing), including
malformed-JSON → 400 and unknown-widgetId → 404.

**Valid submissions stored, linked to the right widget/tenant:** see the
`submissionId` above, plus `tests/validation.test.js`'s
`"a valid submission is accepted and stored"` test, which reads the row
back out of the database and asserts its `data` column matches.

## Abuse protection

**Rate limiting returns 429 under a burst; legitimate traffic keeps working
elsewhere (PROBE 3)** — real run with `RATE_LIMIT_PER_IP_MAX=5`:
```
request 1 -> 201
request 2 -> 201
request 3 -> 201
request 4 -> 201
request 5 -> 201
request 6 -> 429
request 7 -> 429
```
Per-widget limiting proven independently in Jest
(`tests/rateLimit.test.js`, 2/2 passing).

**Honeypot blocks a spam submission without storing it (PROBE 6):**
```
$ curl -s -i -X POST .../submissions \
    -d '{"widgetId":"...","data":{"name":"Bot"},"website":"http://spam.example"}'
HTTP/1.1 200 OK
{"status":"ok"}
```
Confirmed via Jest that the row count for that widget stays at 0 after this
call (`tests/honeypot.test.js`, 3/3 passing).

## Enrichment & safe side effects

**Provider fallback chain, all three branches, deterministic (PROBE 4):**
```
-- both providers up --
{"status":"ok","submissionId":"a751d97a-...","enriched":true}

-- provider A down -> falls back to B --
{"status":"ok","submissionId":"aa456e7c-...","enriched":true}
[geo] provider "mock-provider-a" failed: provider_a_forced_down

-- both providers down -> stored without geo --
{"status":"ok","submissionId":"4ab1ec75-...","enriched":false}
[geo] provider "mock-provider-a" failed: provider_a_forced_down
[geo] provider "mock-provider-b" failed: provider_b_forced_down
[geo] all providers failed — storing submission without geo data
```
Also `tests/geoFallback.test.js`, 3/3 passing, asserting the stored row's
`geo_provider` column directly.

**A failing email/webhook side effect does not block the submission
(PROBE 5):**
```
$ FORCE_EMAIL_FAILURE=true curl -s -X POST .../submissions -d '...'
{"status":"ok","submissionId":"25846621-...","enriched":true}

[jobQueue] "send-confirmation-email" attempt 1/3 failed: simulated_email_provider_outage
[jobQueue] "send-confirmation-email" attempt 2/3 failed: simulated_email_provider_outage
[jobQueue] "send-confirmation-email" attempt 3/3 failed: simulated_email_provider_outage
[jobQueue] "send-confirmation-email" exhausted 3 attempts — logging to failed_jobs
```
The submission returns `201`/`"ok"` despite every email attempt failing.
`tests/jobQueue.test.js` (2/2 passing) additionally asserts a row lands in
`failed_jobs` with `attempts: 3`.

## Idempotency (shared requirement #5)

```
PASS tests/idempotency.test.js
  ✓ retrying the same request with the same Idempotency-Key does not create a second row
  ✓ two different Idempotency-Keys create two separate submissions
  ✓ no Idempotency-Key header at all still works normally (it is optional)
```

## Full automated test suite

```
$ npm test
Test Suites: 7 passed, 7 total
Tests:       23 passed, 23 total
Time:        6.503 s
```

## Documentation

- README with architecture diagram, setup instructions (both SQLite
  quick-start and Docker/Postgres paths), and full API documentation: this
  repo's `README.md`.
- One-page Phase 1 design doc: `docs/DESIGN.md`.
- This file and `BUILDLOG.md`.

## Still to do yourself

- [ ] The browser-based cross-origin render/submit proof above.
- [ ] `docker compose up --build` on your own machine, confirming the
      Postgres path boots clean (this repo's automated evidence above all
      used the SQLite quick-start path — both run the exact same
      application code and Knex migrations, but you should still see the
      Postgres path work with your own eyes before submitting).
- [ ] Push commits incrementally to your own public repo per Section 11 —
      this evidence file describes what the finished code does, not a
      substitute for an honest commit history.
