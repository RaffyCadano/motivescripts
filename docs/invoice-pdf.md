# MotiveScripts invoice PDFs

Phase 18 generates a professional invoice PDF **on demand** from persisted Postgres data. The HTML preview is unchanged. There is no PDF storage, no public invoice URL, and no new tables.

```
Authenticated user → invoice-pdf Edge Function
  → auth.uid() → profiles.role / profiles.client_id
  → authorize invoice
  → SELECT invoices / items / payments / client / project
  → pdf-lib (Deno) → PDF bytes
```

Invoice send/resend uses the same generator and attaches the PDF via Resend when possible.

## Chosen library

**[pdf-lib](https://pdf-lib.js.org/)** (`npm:pdf-lib@1.17.1`) inside Supabase Edge Functions (Deno).

- Works in Deno without Chrome/Puppeteer
- No Node-only binaries
- Not added to the Vite frontend `package.json`
- Draws from a server-built model; the browser never supplies totals or line items

HTML-to-PDF (Playwright, Puppeteer, Gotenberg) is not used: Edge Functions do not run a browser.

## Edge Function

`supabase/functions/invoice-pdf/index.ts`

- `POST` `{ invoiceId }`
- `verify_jwt = false` in `config.toml`; the function still requires a user JWT and calls `auth.getUser()`
- Returns `application/pdf` with `Content-Disposition: attachment; filename="MotiveScripts-Invoice-….pdf"`
- `Cache-Control: no-store`
- Read-only: never UPDATE invoices, items, payments, or status

Shared code:

- `supabase/functions/_shared/invoicePdf.ts` — layout + filename
- `supabase/functions/_shared/loadInvoicePdf.ts` — load persisted cents and public fields
- `supabase/functions/_shared/money.ts` — integer-cent **display** only
- `supabase/functions/_shared/brand-icon.png` — existing MotiveScripts mark (optional; PDF still generates if missing)

## Authorization

| Caller | Allowed invoices |
| --- | --- |
| Admin | Any agency invoice, including drafts |
| Client | Own invoice where `profiles.client_id = invoices.client_id` and status is not `draft` or `cancelled` |
| Other / anonymous | Denied |

Unauthorized or unknown ids return `{ ok: false, error: "not_found" }` with **no invoice payload** (no IDOR leak). The browser cannot pass a client id, email, or amounts that change the document.

Ownership path: `auth.uid()` → `profiles.client_id` → `invoices.client_id`.

## PDF contents

From Postgres (not from the React preview):

- Header: MotiveScripts, logo when bundled, support email, **INVOICE**, number, effective status (including overdue)
- Bill to: business name, contact, email, phone
- Project name + business name when `project_id` is set
- Line items: description, quantity, unit price, **stored** `total_cents`
- Summary: subtotal, discount, tax, total, amount paid, amount due (invoice row cents)
- Payments: date, method (including Stripe/manual), received/reversed, public reference only
- Client-visible `invoices.notes`
- Footer: “Thank you for your business.”

Omitted: admin notes, staff identity, Stripe PaymentIntent / Checkout ids, webhook ids, database UUIDs, emails in filenames.

After a payment, generate again — the new PDF shows current `amount_paid_cents` / `amount_due_cents`. There is no PDF version table.

## Filename

`MotiveScripts-Invoice-{sanitized-invoice-number}.pdf`

Example: `MotiveScripts-Invoice-MS-INV-2026-001.pdf`

Sanitization keeps `A–Z a–z 0–9 . _ -` only.

## Email

`document-email` `kind: "invoice"` (admin JWT, after send or resend):

- Same branded HTML as before, with **total**, **amount due**, due date, and Client Portal link
- Attaches the generated PDF when generation succeeds
- If PDF generation fails, the email is still sent without the attachment
- Email does **not** change invoice status or payments
- Draft invoices are not emailed

Payment receipts (`kind: "payment"`) are unchanged and do not attach a PDF.

## Local development

1. `supabase functions serve invoice-pdf --no-verify-jwt` (function still checks the user JWT)
2. Sign in as admin or client in the app
3. Open an invoice → **Download PDF**
4. Optional: `supabase functions serve document-email` and send/resend an invoice

Optional smoke (Deno, no Supabase):

```bash
deno run --allow-read --allow-net --node-modules-dir=none supabase/functions/_shared/smoke_pdf.ts
```

No new Vite variables. Never put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or `RESEND_API_KEY` in `VITE_` vars.

## Deployment

```bash
supabase functions deploy invoice-pdf
supabase functions deploy document-email
```

No SQL migration. Redeploy `document-email` so invoice send includes the PDF attachment.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Friendly “Unable to generate invoice PDF” | Function not deployed, user signed out, or invoice not visible to that role |
| Email without attachment | Function logs `document-email invoice pdf failed`; Resend still delivered HTML |
| Missing logo | `_shared/brand-icon.png` not in the bundle; text header still renders |
| Wrong paid/due | Confirm webhook/manual payment landed; regenerate (no cache) |

## Testing

Use two Auth users. Do not treat this doc as a substitute for a live Stripe/Supabase pass.

1. Admin downloads a draft
2. Admin downloads a sent invoice
3. Client downloads their invoice
4. Client uses another client’s invoice UUID → denied / empty error
5. Multiple line items, tax, discount
6. Partial pay, paid in full, overdue, cancelled (admin)
7. Stripe and mixed ledger payments reflected in paid/due
8. Filename sanitized
9. UI shows “Generating PDF...” then a friendly error if the function is down

## Security

- No public Storage bucket, no public PDF route
- Service role only inside Edge Functions after authorization
- Totals are not taken from the request body
- PDF generation does not write financial rows
- Downloads do not create notifications or activity events

## Production

`invoice-pdf` CORS allows `PUBLIC_SITE_URL` (and localhost only when that origin is local). Redeploy after Phase 21. Authorization still uses the **user JWT** plus `staff_can_access_client` for staff.

Launch: [production-launch-checklist.md](./production-launch-checklist.md).
