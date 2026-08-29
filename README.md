# MotiveScripts

Vite + React agency site with an Admin Dashboard and Client Portal.

Business records persist in **Supabase PostgreSQL**. File binaries persist in a private **Supabase Storage** bucket (`project-files`). Authentication uses magic links. Roles and row access are enforced in Postgres (see [docs/auth.md](docs/auth.md)).

Runtime TypeScript does not ship mock/demo CRM records. An empty database shows real empty states. Optional development seed SQL is in [supabase/dev-seed/](supabase/dev-seed/) and must not be applied on production (see [docs/database.md](docs/database.md)).

## Setup

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`).
2. Apply the SQL in `supabase/migrations/` to the same Supabase project (see [docs/database.md](docs/database.md)). Client invitations need the `client-invitation` Edge Function. Staff invitations need `staff-invitation`. Start a Project needs `public-lead`. Proposal, contract, invoice, and payment-receipt email use `document-email`. Invoice PDFs use `invoice-pdf`. Proposal and contract PDFs use `proposal-pdf` and `contract-pdf`. Stripe Checkout uses `create-checkout-session` and `stripe-webhook`. Secrets are listed in [docs/client-invitations.md](docs/client-invitations.md), [docs/team-management.md](docs/team-management.md), [docs/invoices-payments.md](docs/invoices-payments.md), [docs/invoice-pdf.md](docs/invoice-pdf.md), [docs/proposal-contract-pdf.md](docs/proposal-contract-pdf.md), and [docs/stripe-payments.md](docs/stripe-payments.md).
3. Install and run:

```bash
npm install
npm run dev
```

Never put a service-role key, Stripe secret (`sk_…`, `whsec_…`), or Resend API key in a `VITE_` variable. Those values would be exposed in the browser bundle.

## Production

Phase 21 hardens security, errors, and launch docs. It does **not** mean the product is live-verified.

- Environment split and secrets: [.env.example](.env.example), [docs/production-launch-checklist.md](docs/production-launch-checklist.md)
- Manual live tests: [docs/production-smoke-test.md](docs/production-smoke-test.md)
- Auth / RLS: [docs/auth.md](docs/auth.md)
- Database / migrations: [docs/database.md](docs/database.md)
- Stripe live switch (manual): [docs/stripe-payments.md](docs/stripe-payments.md)

Deploy SQL migrations first, then Edge Functions, then the Vite `dist/`. See the launch checklist for order.

Until Auth, RLS, Storage, Resend, Stripe webhooks, and the smoke plan have been run on the real project, treat launch as **not verified**.

## Scripts

- `npm run dev` — local development
- `npm run build` — `tsc -b` then Vite production build
- `npm run preview` — preview the production build

## What is still frontend-only

Public marketing pages and non-Stripe processors (PayPal, GCash, and similar). Start a Project writes a lead through `public-lead`. Invoices and manual payments: [docs/invoices-payments.md](docs/invoices-payments.md). Invoice PDFs: [docs/invoice-pdf.md](docs/invoice-pdf.md). Proposal and contract PDFs: [docs/proposal-contract-pdf.md](docs/proposal-contract-pdf.md). Stripe Checkout: [docs/stripe-payments.md](docs/stripe-payments.md).
