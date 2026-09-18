<div align="center">
  
# Embeddable Widget & Lead-Capture Platform

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-supported-003B57?style=flat&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white)
![Tested with Jest](https://img.shields.io/badge/tested%20with-Jest-C21325?style=flat&logo=jest&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)
![GitHub last commit](https://img.shields.io/github/last-commit/MusaIslamFahad/flyrank-capstone-widgetplatform)
![GitHub repo size](https://img.shields.io/github/repo-size/MusaIslamFahad/flyrank-capstone-widgetplatform)
![GitHub stars](https://img.shields.io/github/stars/MusaIslamFahad/flyrank-capstone-widgetplatform?style=social)

### FlyRank Internship · Backend Track · Capstone

**Let a customer define a widget, hand them one line of `<script>`, and
safely catch everything the public internet throws back at it validated,
spam-filtered, enriched, and dashboarded.**

<br/>

> See [`docs/DESIGN.md`](docs/DESIGN.md) for the one-page design doc (data
model, API surface, layer sketch, explicit non-goal) written before this
was built, and [`BUILDLOG.md`](BUILDLOG.md) for an honest account of where
AI assistance was used.

</div>

## Architecture

```
Widget Owner (authenticated, JWT)
  → Widget Management API  →  widgets table (tenant-isolated)  →  embed snippet

Customer Website (any origin)
  <script src="widget.v1.js?id=123">
  → GET /api/public/widgets/:id/config   (public · cached 60s · CORS: *)
  → renders the widget in the page

Website Visitor
  → POST /api/public/submissions          (public · CORS: *)
    1. Idempotency-Key replay check       → returns cached response if seen
    2. Schema validation (Zod)            → bad payload? clean 4xx, never 500
    3. Rate limit (per-IP, per-widget)    → flood? 429, service stays up
    4. Honeypot spam check                → bot? fake 200, nothing stored
    5. Geo enrichment: Provider A -(fail)-> Provider B -(fail)-> store anyway
    6. Store submission
    7. Enqueue confirmation email          → off the request path, retries,
                                              failure logged to failed_jobs,
                                              NEVER blocks the response above

Widget Owner (authenticated)
  → Dashboard API  ←—  submissions + stats (tenant-isolated)
```

## Tech stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 + Express |
| Database | PostgreSQL (Docker) or SQLite (zero-setup quick start) — same code, via Knex |
| Auth | JWT (bcrypt-hashed passwords) |
| Validation | Zod |
| Rate limiting | express-rate-limit (per-IP) + a small custom sliding window (per-widget) |
| Background jobs | A minimal in-process queue with retries + a `failed_jobs` audit table |
| Tests | Jest + Supertest, 23 tests across 7 suites |

## Quick start (no Docker — SQLite)

```bash
npm install
npm run migrate
npm run seed        # prints a demo login + a ready-to-use widget id
npm run dev          # API on http://localhost:3000
```

In a second terminal, serve the plain-HTML "customer site" on a **different
origin** (a different port counts):

```bash
npm run test-site    # serves test-site/ on http://localhost:5500
```

Open `http://localhost:5500/index.html?widgetId=<the-uuid-from-seed-output>`
— that page is on port 5500, the API is on port 3000, so the widget it
loads is a genuine cross-origin request, exactly like a real customer's
site would make.

## Full stack (Docker + Postgres)

```bash
docker compose up --build
docker compose exec app npm run seed
```

The API is on `http://localhost:3000`; Postgres is exposed on `:5432` for
inspection. Migrations run automatically on container startup.

## Running the tests

```bash
npm test
```

23 tests covering validation/4xx handling, the honeypot, per-IP and
per-widget rate limiting, the full geo-provider fallback chain (deterministic
via `GEO_MODE=mock`), multi-tenant isolation, idempotency, and the
"email side effect fails but the submission still succeeds" resilience
requirement (including the `failed_jobs` alert record).

## Environment variables

See [`.env.example`](.env.example) for the full list with explanations.
Two worth calling out for manual testing / grading:

- `GEO_MODE=mock` (default) uses deterministic in-process fake geo
  providers, toggled with `FORCE_PROVIDER_A_DOWN` / `FORCE_PROVIDER_B_DOWN`,
  so the fallback chain can be proven without depending on the public
  internet or the two free providers' uptime. Set `GEO_MODE=live` to hit
  the real APIs (`ip-api.com`, then `ipapi.co`) during manual dev.
- `FORCE_EMAIL_FAILURE=true` deterministically fails the confirmation-email
  side effect on every attempt, to prove it never blocks the submission
  response (and that it gets logged to `failed_jobs` once retries are
  exhausted).

## API reference

All authenticated routes expect `Authorization: Bearer <token>` from
`/api/auth/login` or `/api/auth/register`.

### Auth

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/register` | none | `{ name, email, password }` |
| POST | `/api/auth/login` | none | `{ email, password }` |

Both return `{ tenant: { id, name, email }, token }`.

### Widget management (tenant-isolated)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/widgets` | Bearer | `{ type, title, description?, fields[], buttonText?, displayOptions? }` |
| GET | `/api/widgets` | Bearer | list the tenant's own widgets |
| GET | `/api/widgets/:id` | Bearer | 404 if it belongs to another tenant |
| PUT | `/api/widgets/:id` | Bearer | partial update; bumps `version` |
| DELETE | `/api/widgets/:id` | Bearer | 204 on success |
| GET | `/api/widgets/:id/embed-snippet` | Bearer | `{ snippet: "<script ...>" }` |

`field` shape: `{ name, label, type: "text"|"email"|"textarea"|"checkbox", required }`.

### Widget delivery (public)

| Method | Path | Cache |
|---|---|---|
| GET | `/widget.v1.js` | `public, max-age=31536000, immutable` |
| GET | `/api/public/widgets/:id/config` | `public, max-age=60` + `ETag` |

### Public submission

`POST /api/public/submissions`

```json
{ "widgetId": "...", "data": { "email": "a@b.com" }, "website": "" }
```

`website` is the honeypot field — leave it empty (the rendered widget hides
it from real users with CSS). Optional `Idempotency-Key` header dedupes
retried submissions. Responses:

- `201` — `{ status: "ok", submissionId, enriched: boolean }`
- `200` — `{ status: "ok" }` when the honeypot was triggered (nothing stored)
- `400` — validation failure or malformed JSON
- `404` — unknown `widgetId`
- `413` — payload too large
- `429` — rate limited (per-IP or per-widget)

### Dashboard (tenant-isolated)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/dashboard/overview` | total + today's submission counts, per-widget counts |
| GET | `/api/dashboard/widgets/:id/stats` | daily counts (30d) + country breakdown |
| GET | `/api/dashboard/submissions?widgetId=&page=&pageSize=` | paginated submissions |

## Limitations (honest, on purpose)

- The rate limiter and background job queue are in-process — see the
  explicit non-goal in `docs/DESIGN.md` for why, and what a real
  multi-instance deployment would need instead (Redis-backed store, a real
  queue).
- Email/webhook delivery is simulated (logged to the console), per the
  brief's realistic-scope guidance — what's exercised and tested is the
  failure-isolation behavior, not real SMTP delivery.
- The widget UI is intentionally minimal styling, per Section 7 of the
  brief ("the grade lives in the backend, not the CSS").
- Live geo lookups (`GEO_MODE=live`) depend on two free third-party APIs'
  uptime and rate limits; `GEO_MODE=mock` (the default) is what the
  automated tests and the deterministic fallback-chain proof use.

## 🤝 Contributing

Contributions are welcome! If you'd like to improve the project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

**Ideas for contributions:** a Redis-backed rate limiter and a real job queue (BullMQ/SQS) for multi-instance deployments, additional geo-enrichment providers beyond ip-api.com/ipapi.co, a lightweight admin UI on top of the dashboard API (currently JSON-only by design), webhook signing/HMAC verification for the confirmation side effect, CAPTCHA or proof-of-work as a stronger bot-defense layer, or a real-time dashboard via WebSockets/SSE.

---

## 👤 Author

**Md. Musa Islam Fahad**  
CSE (Data Science) · Daffodil International University, Dhaka  
📧 musa.islam.fahad@gmail.com  
🌐 [Portfolio](https://musaislamfahad.vercel.app) · [GitHub](https://github.com/MusaIslamFahad) · [LinkedIn](https://linkedin.com/in/md-musa-islam-fahad-b18759249)

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) for details.  
Free to use, modify, and deploy.

---

## 🙏 Acknowledgements

- [Express](https://expressjs.com) - The web framework this API is built on
- [Knex.js](https://knexjs.org) - SQL query builder powering the SQLite/Postgres dual-database layer
- [ip-api.com](https://ip-api.com) & [ipapi.co](https://ipapi.co) - Free geolocation APIs used in the enrichment fallback chain

---

<div align="center">

Built as a FlyRank AI Backend Track capstone - a hardened, multi-tenant embeddable widget platform.

**[⬆ Back to Top](#embeddable-widget--lead-capture-platform)**

</div>
