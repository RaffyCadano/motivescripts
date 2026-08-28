# MotiveScripts proposal and contract PDFs

Phase 19 generates professional **proposal** and **contract** PDFs **on demand** from persisted Postgres data. The existing HTML document previews are unchanged. There is no PDF storage, no public document URL, and no new tables.

```
Authenticated user → proposal-pdf or contract-pdf Edge Function
  → auth.uid() → profiles.role / profiles.client_id
  → authorize ownership
  → SELECT identity + the correct revision (published vs working)
  → pdf-lib (Deno) → PDF bytes
```

Sending a proposal or contract still uses `document-email`. After Phase 19 the email attaches the generated PDF when generation succeeds.

This phase does **not** start Team Management, production launch, Stripe changes, e-signatures, or PDF storage.

## Chosen library

**[pdf-lib](https://pdf-lib.js.org/)** (`npm:pdf-lib@1.17.1`) inside Supabase Edge Functions (Deno), same as invoice PDFs.

- Works in Deno without Chrome/Puppeteer
- Not added to the Vite frontend `package.json`
- Draws from a server-built model; the browser never supplies totals, line items, or contract text

Shared layout lives in `supabase/functions/_shared/pdfLayout.ts` (also used by invoice PDFs).

## Edge Functions

`supabase/functions/proposal-pdf/index.ts`

- `POST` `{ proposalId }`
- Returns `application/pdf` with `Content-Disposition: attachment; filename="MotiveScripts-Proposal-….pdf"`

`supabase/functions/contract-pdf/index.ts`

- `POST` `{ contractId }`
- Returns `application/pdf` with `Content-Disposition: attachment; filename="MotiveScripts-Contract-….pdf"`

Both functions:

- Set `verify_jwt = false` in `config.toml`; they still require a user JWT and call `auth.getUser()`
- Use `Cache-Control: no-store`
- Are **read-only**: never UPDATE proposals, contracts, revisions, snapshot fields, or status
- Do not publish a revision
- Do not create payments, activity events, or notifications

Shared code:

- `supabase/functions/_shared/proposalPdf.ts` / `contractPdf.ts` — layout + filename
- `supabase/functions/_shared/loadProposalPdf.ts` / `loadContractPdf.ts` — load persisted fields
- `supabase/functions/_shared/pdfAuth.ts` — JWT + role + ownership
- `supabase/functions/_shared/documentStatus.ts` — effective status labels
- `supabase/functions/_shared/money.ts` — integer-cent **display** only
- `supabase/functions/_shared/brand-icon.png` — MotiveScripts mark (optional; PDF still generates if missing)

## Authorization

Ownership path: `auth.uid()` → `profiles.client_id` → `proposals.client_id` / `contracts.client_id`.

The browser cannot pass a client id, role, revision id, or amounts that change the document.

| Caller | Allowed documents |
| --- | --- |
| Admin | Any agency proposal or contract, including drafts |
| Client | Own document where `profiles.client_id` matches, **and** a published revision exists that is not draft/cancelled |
| Other / anonymous | Denied |

Unauthorized or unknown ids return `{ ok: false, error: "not_found" }` with **no document payload** (no IDOR leak). Unauthenticated requests return `401` without looking up the row.

## Revision / snapshot rules

Phase 15 identity tables keep `working_revision_id` and `published_revision_id`. PDF generation respects that model. Downloading a PDF never publishes a working draft.

**Client requests**

- Render **only** `published_revision_id`
- Never render `working_revision_id` when it differs from published
- Never expose unpublished admin edits
- If there is no published revision, return `not_found`
- Proposal line items come from frozen `snapshot_items` when present
- Contract body comes from frozen `snapshot` jsonb when present

**Admin requests**

- If a published revision exists (sent / viewed / accepted / declined / expired / cancelled), render **that** published snapshot
- If there is no published revision, render the persisted working draft (admins already have access)
- Unsaved form fields in the browser are ignored

## PDF contents — proposal

From Postgres (not from the React preview):

- Header: MotiveScripts, logo when bundled, support email, **PROPOSAL**
- Proposal number, title, revision number, date, valid-until date
- Prepared for: business name, contact, email, phone
- Linked project name when `project_id` is set
- Overview, scope, deliverables, timeline from the chosen revision
- Line items: name, description, quantity, unit price, **stored** `total_cents`
- Grand total from persisted `investment_cents`
- Subtotal is shown only when the sum of stored line totals differs from `investment_cents`
- Payment terms, terms, client-visible notes
- Status (including effective expired when `valid_until` is in the past)
- Acceptance date and accepted email when present, with portal-acceptance language

Omitted: `proposal_admin_notes`, staff identity, user UUIDs, database ids, invented tax/discount rows.

**Tax and discount:** proposal tables have no tax or discount columns. Those rows are not invented on the PDF. Grand total is `investment_cents` from PostgreSQL.

## PDF contents — contract

From Postgres:

- Header: MotiveScripts, logo when bundled, support email, **CONTRACT**
- Contract number, title, revision number, date, expiration, effective date
- Prepared for: business name, contact, email, phone
- Linked proposal number and project name when set
- Stored sections only: parties, scope, responsibilities, timeline, compensation, payment terms, confidentiality, intellectual property, revisions, termination, general terms
- Status (including effective expired)
- Acceptance date and accepted email when present

The PDF states that this is a workflow agreement, **not legal advice**, and **not a qualified digital signature**. It does not claim DocuSign / Adobe Sign / similar e-signature status.

Omitted: `contract_admin_notes`, `accepted_by_user_id`, invented legal clauses.

## Filenames

Proposal: `MotiveScripts-Proposal-{sanitized-proposal-number}.pdf`  
Example: `MotiveScripts-Proposal-MS-2026-001.pdf`

Contract: `MotiveScripts-Contract-{sanitized-contract-number}.pdf`  
Example: `MotiveScripts-Contract-MS-CON-2026-001.pdf`

Sanitization keeps `A–Z a–z 0–9 . _ -` only.

## Download flow

1. Signed-in admin or client clicks **Download PDF**
2. The browser sends the user JWT + anon/publishable key to `/functions/v1/proposal-pdf` or `/functions/v1/contract-pdf`
3. The function authorizes, loads persisted data, generates bytes, and returns `application/pdf`
4. The browser saves the blob using the `Content-Disposition` filename

The frontend never calls `functions.invoke` for binary PDFs. Service-role keys are never in `VITE_` variables.

## Email

`document-email` `kind: "proposal"` and `kind: "contract"` (admin JWT, after send):

- Same branded HTML as Phase 15
- Generates the PDF with **client** audience (published revision only)
- Attaches the PDF when generation succeeds
- If PDF generation fails, the email is still sent without the attachment
- Email does **not** change proposal/contract status, revisions, or snapshots
- Send RPC still commits first; email failure does **not** roll back `sent`

Secrets (Dashboard, not `VITE_`): `RESEND_API_KEY`, `PUBLIC_SITE_URL`, optional `RESEND_FROM`, `SUPPORT_EMAIL`.

Payment receipts (`kind: "payment"`) and invoice HTML are unchanged except invoice already attached a PDF in Phase 18.

## Local development

1. `supabase functions serve proposal-pdf --no-verify-jwt` (function still checks the user JWT)
2. `supabase functions serve contract-pdf --no-verify-jwt`
3. Sign in as admin or client in the app
4. Open a proposal or contract → **Download PDF**
5. Optional: `supabase functions serve document-email` and send a document

Optional smoke (Deno, no Supabase). Because this repo has a Vite `package.json`, pass `--node-modules-dir=none` so pdf-lib is not installed into the frontend `node_modules`:

```bash
deno run --allow-read --allow-net --node-modules-dir=none supabase/functions/_shared/smoke_pdf.ts
```

No new Vite variables. Never put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or `RESEND_API_KEY` in `VITE_` vars.

## Deployment

These functions are **not** live until they are deployed to the project.

```bash
supabase functions deploy proposal-pdf
supabase functions deploy contract-pdf
supabase functions deploy document-email
```

Redeploy `document-email` so proposal and contract send include the PDF attachment.

No SQL migration.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Friendly “Unable to generate the proposal/contract PDF” | Function not deployed, user signed out, or document not visible to that role |
| Client download fails on a draft | Expected — clients only receive published revisions |
| Email without attachment | Function logs `document-email proposal pdf failed` or `contract pdf failed`; Resend still delivered HTML |
| Missing logo | `_shared/brand-icon.png` not in the bundle; text header still renders |
| PDF shows old content | Unsaved admin edits are ignored; regenerate after save/send. Sent documents use the published revision |

## Testing

Use two Auth users. Do not treat this doc as a substitute for a live Supabase/Resend pass.

1. Admin downloads a draft proposal and draft contract
2. Admin downloads sent / viewed / accepted / declined / expired documents
3. Client downloads their own published proposal and contract
4. Client uses another client’s UUID → denied / empty error
5. Client cannot receive a working draft when a published revision exists
6. Download does not change status, create a payment, or write activity
7. Long descriptions, many line items, and long contract text paginate with page numbers
8. Filename sanitized
9. UI shows “Generating PDF...” then a friendly error if the function is down
10. Send email still succeeds if PDF generation fails

## Security

- No public Storage bucket, no public PDF route
- Service role only inside Edge Functions after authorization
- Totals and contract text are not taken from the request body
- PDF generation does not write document rows
- Downloads do not create notifications or activity events
- Clients never receive unpublished revisions

## Production

`proposal-pdf` and `contract-pdf` CORS follow `PUBLIC_SITE_URL`. Redeploy with `invoice-pdf` after Phase 21. Staff need assignment + view grant; clients need published revision ownership.

Launch: [production-launch-checklist.md](./production-launch-checklist.md).
