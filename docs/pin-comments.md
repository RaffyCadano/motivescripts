# Pin comments

Pin-positioned annotation comments on image deliverables (PNG/JPG only — never PDFs), additive to the existing text feedback/approval flow ([database.md](./database.md) covers `feedback`/`approvals`). Not part of the original numbered phase sequence — added later, same conventions as the rest of the app (RLS as the real boundary, `SECURITY DEFINER` RPCs for the client-facing write path).

```
Client (or staff) clicks a spot on the current image version
  → client_submit_pin_comment / staff_submit_pin_comment (signature checked server-side)
  → pin_comments row + activity row, same transaction
  → activity_notify_recipients() notifies admins (pin_comment_received)
  → staff can resolve; both sides see markers on the image
```

## Schema

Migrations: `20260906000000_pin_comments.sql`, `20260907000000_staff_pin_comments.sql`.

`pin_comments`:

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `version_id` | Required. FK → `file_versions` |
| `deliverable_id` / `project_id` / `client_id` | Denormalized from `version_id` at insert time, server-side — never trusted from the browser |
| `x_pct` / `y_pct` | `numeric(6,3)`, `0–100` — position as a percentage of the rendered image, not pixels, so it stays correct across responsive breakpoints |
| `body` | Required, non-empty |
| `status` | `Open` (default) or `Resolved` |
| `created_by` | Always `auth.uid()` |
| `resolved_at` / `resolved_by` | Set together on resolve |

## RLS

| Caller | Select | Insert | Resolve (update) |
| --- | --- | --- | --- |
| Admin | All | Via RPC or direct (see below) | Yes |
| Staff with `feedback.manage` or `files.view` on the project | All pins on that project | Via RPC, `feedback.manage` only | `feedback.manage` only |
| Client (own `client_id`) | Own pins | Via RPC only | No |

Client inserts go through `client_submit_pin_comment`, not a direct table insert, so the same ownership-chain check `feedback_insert_own` already does (join `file_versions → deliverables → projects`, confirm the client owns that project and the deliverable is in a review status) applies here too. A `pin_comments_client_insert` RLS policy exists as a second, redundant layer in case of a direct insert attempt — the RPC is the intended path.

Staff inserts can go through the plain `pin_comments_staff_insert` RLS policy (table-level, no RPC required) **or** `staff_submit_pin_comment` — the RPC is preferred since it derives `project_id`/`deliverable_id`/`client_id` server-side from `version_id` rather than trusting whatever the caller supplies, which is the same reasoning that makes the client path RPC-only.

## RPCs

Both `security definer`, both re-derive the file-version → deliverable → project chain from `p_version_id` — no `client_id`/`project_id`/`deliverable_id` is ever accepted as a parameter:

- `client_submit_pin_comment(p_version_id, p_x_pct, p_y_pct, p_body)` — requires `is_client()` and that the caller's `current_client_id()` matches the project's client. Requires the deliverable to be `In Review` or `Needs Changes` (same review-window gate as text feedback). Rejects with `NOT_FOUND`, `INVALID_STATUS`, `EMPTY_BODY`.
- `staff_submit_pin_comment(p_version_id, p_x_pct, p_y_pct, p_body)` — requires `is_admin()` or `staff_may_project(project_id, 'feedback.manage')`. No review-status gate — staff can flag something on a deliverable regardless of its current status (e.g. pointing something out to a teammate before sending for client review).
- `resolve_pin_comment(p_pin_id)` — `is_admin()` or `staff_may_project(project_id, 'feedback.manage')`.

## Notifications

No new trigger — `activity_notify_recipients()` (`20260828160000_messaging_notifications.sql`) gained one more `elsif` branch keyed on `activity_type = 'pin_comment_submitted'`, calling `notify_admins('pin_comment_received', ...)`. Both RPCs insert the same `activity` row shape (`metadata: {deliverable_id, pin_id}`) so the existing `deliverable` extraction in that function works unchanged for either client- or staff-authored pins.

## UI

The pin overlay lives at the `StoredFilePreview` layer (`src/components/files/StoredFilePreview.tsx`) — the one piece of preview code shared by the client (`ClientReview.tsx`) and admin (`VersionPreviewModal.tsx`) surfaces, which are otherwise two separate implementations. Three new optional props: `pins`, `onImageClick`, `renderPinMarker`. When all three are omitted, rendering is byte-identical to before — fully additive, no risk to any other caller of this component. The props are only ever wired up on the image branch, never the PDF (`iframe`) branch, so pin placement is structurally impossible on a PDF rather than merely policy.

- **Client** (`ClientReview.tsx`): clicking the image in the file-preview modal (only when feedback is currently allowed on that deliverable) opens an inline comment composer; existing pins render as numbered markers.
- **Admin/staff** (`VersionPreviewModal.tsx`): an "Add pin" toggle switches the image into the same click-to-place mode; pins list below the image with a "Resolve" action on open ones. Resolved pins render as a muted marker instead of the accent color.

## Out of scope

PDF/multi-page annotation. Threaded replies on a single pin (a pin is one comment, not a conversation). Editing or deleting a pin after creation — only resolve.

## Apply

Migrations `20260906000000` and `20260907000000`, in order, after `20260905040000`. No Edge Function changes, no new secrets.
