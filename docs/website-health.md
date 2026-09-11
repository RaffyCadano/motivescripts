# Website Health Monitoring (v1)

Manual, on-demand server-side reachability checks of a project's production or staging URL. Not a monitoring platform — no scheduling, no alerting, no third-party integration. One edge function, one history table, reusing the existing `staff_may_project` permission check RLS itself is built on.

```
Staff clicks "Check Now" on a project (production or staging)
  → check-website-health edge function
  → re-checks staff_may_project(project_id, 'projects.manage') as the calling user
  → reads production_url / staging_url from the projects row itself (service role)
  → validates the URL (http(s) only, no embedded credentials, no private/internal host)
  → fetches it (10s timeout), classifies the result
  → inserts one website_health_checks row
  → UI derives "current status" from the latest row for that project + environment
```

## Schema

Migrations: `20260928000000_website_health_monitoring.sql`, `20260930070000_website_health_staging.sql`.

`website_health_checks`:

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `project_id` | FK → `projects`, `on delete cascade` |
| `checked_at` | Defaults to `now()` |
| `environment` | `production` (default) or `staging` — which URL column on `projects` this check was against |
| `status` | `healthy`, `degraded`, or `down` (see Classification below) |
| `http_status` | Null when no response was ever received |
| `response_time_ms` | Null when no response was ever received |
| `error_message` | Up to 500 chars, empty string for a healthy check |
| `checked_by` | The staff member who triggered a manual check; null once/if scheduled checks are added later |

Current health is deliberately **not** a column anywhere — it's derived in the frontend from the latest row per project/environment, so there is exactly one place a result lives.

## Authorization

Two independent checks, both required:

1. **Caller identity**: the edge function verifies the request's JWT via Supabase Auth (`userClient.auth.getUser()`) — not trusted from the request body.
2. **Permission**: `staff_may_project(project_id, 'projects.manage')`, invoked as the calling user via RPC — the same SQL function the table's own RLS uses, not a reimplementation. A staff member without `projects.manage` on that project (or a client) gets `not_allowed`.

Writes to `website_health_checks` go through the service-role client only — there is no INSERT/UPDATE/DELETE grant to `authenticated` at all, so a client can never fabricate a check row directly. Reads use the same `staff_may_project(..., 'projects.view')` policy as `project_development`; there is no client-facing read policy in v1.

## Inputs

The request body carries only `{ projectId, environment? }` — never a URL. `environment` defaults to `"production"`; any value other than `"staging"` is treated as `"production"`. The URL actually checked is always read server-side from the `projects` row itself (`production_url` or `staging_url`), so this endpoint cannot be used as an arbitrary URL-fetch proxy regardless of what a caller sends.

## Classification

Documented once, here, since it's the single source of truth the UI and history both read:

- **healthy** — 2xx/3xx response.
- **degraded** — 4xx/5xx response. The site is reachable; the response itself is the problem. A single 5xx is not escalated to "down" in v1 — that would require correlating multiple checks over time, deliberately out of scope for v1's per-check classification.
- **down** — no HTTP response was ever received at all: timeout, DNS failure, connection refused, TLS failure, or too-many-redirects.

## Timeout

10 seconds (`AbortController`), classified as `down` with `"Connection timed out"` on expiry.

## SSRF protections and their limitations

`supabase/functions/_shared/websiteUrl.ts` (`validateProductionUrl`) rejects, before any fetch is attempted:

- Non-`http`/`https` schemes.
- URLs with embedded credentials (`user:pass@host`).
- Literal `localhost`, `0.0.0.0`, `*.local` hostnames.
- Literal private/loopback/link-local IPv4 ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` — the last one covers the cloud-metadata address too).
- Literal private/loopback/link-local IPv6 ranges (`::1`, `::`, `fe80::/10`, `fc00::/7`), including IPv4-mapped IPv6 literals (`::ffff:127.0.0.1`), with correct handling of the bracketed form `URL.hostname` returns for IPv6 (`[::1]`).

**This is a literal-hostname check only, not DNS-rebinding protection.** A hostname that *resolves* to a private/internal address at fetch time — rather than being a private-looking literal in the URL itself — is not caught here; the request is served by whatever `fetch()` actually connects to. Closing that fully would mean resolving the hostname server-side, validating the resolved address, and pinning the actual HTTP connection to that address, which needs either `Deno.resolveDns()` plus low-level connection control, or an equivalent HTTP client with DNS pinning. Whether `Deno.resolveDns()` is available in Supabase's Edge Function runtime (not stock Deno Deploy) was not verified before writing this — flagged here rather than shipped unverified against a working feature, since deploying a broken health check function would be a regression, not an improvement.

## Manual Check Now

The only trigger mechanism in v1. There is no scheduled/automated check — no `pg_net` or equivalent HTTP-capable Postgres scheduler is configured in this project. `check-website-health` and the manual button are v1's complete mechanism; a scheduler could call the same function later without changing the data model or the classification rules above.

## What's real vs. what's planned

Implemented: manual check-now for both production and staging, per-check history, environment-aware RLS-equivalent authorization, the classification rules above, the SSRF protections above.

Not implemented, and out of scope for v1 per explicit instruction: scheduled/automated checks, alerting/notifications on a status change, GitHub/Vercel deployment integration, Sentry or other runtime error monitoring, response-time trend analysis or uptime percentages.
