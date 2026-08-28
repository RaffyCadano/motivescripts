# Development seed (optional)

**DEVELOPMENT ONLY. Do not apply on production.**

`seed_demo_data.sql` inserts fake clients, leads, projects, milestones, tasks, deliverable metadata, feedback, approvals, and activity (ABC Landscaping, Harbor & Pine, Smith Auto, BrightPath, and related names).

The React application does **not** load these rows from TypeScript. They only appear if this SQL is run against a database.

Production must skip this file so Admin, Client, and Staff pages show real empty states when there are zero business records.

## When to use it

Local or staging databases that need a populated CRM for manual UI work.

## How to apply

1. Apply versioned schema migrations first (`supabase/migrations/`).
2. Then run `seed_demo_data.sql` in the Supabase SQL Editor, or `psql` against a **non-production** database.
3. Optional invoice demo rows in `20260829100000_invoices_payments.sql` insert only if the seed clients already exist.

Do not re-run this file against a database that already applied `20260828140000_auth_roles_rls.sql` unless you understand that internal client JSON now lives in `client_staff_data`.

Regenerate this SQL with `node scripts/build-seed.mjs` (writes here, never into `supabase/migrations/`).
