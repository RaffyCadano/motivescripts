import { useEffect, useState, type FormEvent } from "react";
import type { CareRequest, CareRequestCategory } from "@/data/careRequests";
import { CARE_REQUEST_CATEGORY_LABELS, CARE_REQUEST_STATUS_LABELS } from "@/data/careRequests";
import { listCareRequests, submitCareRequest } from "@/data/careRequestsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const statusToneClass: Record<CareRequest["status"], string> = {
  New: "border-[var(--client-line)] text-[var(--client-muted)]",
  "In Progress": "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.06)] text-[var(--client-blue)]",
  Done: "border-emerald-700/30 bg-[rgb(16_185_129_/_0.08)] text-emerald-800",
};

function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Where a client asks for the small updates and support their Website Care plan covers, shown next
 * to "Choose a plan" once the site has launched. Submitting requires an active plan -- the server
 * enforces this (care_requests_before_insert); `hasActiveCarePlan` just decides whether this shows
 * the form or a nudge toward "Choose a plan" above.
 */
export function ClientCareRequests({
  clientId,
  projectId,
  hasActiveCarePlan,
}: {
  clientId: string;
  projectId: string;
  hasActiveCarePlan: boolean;
}) {
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<CareRequestCategory>("quick_update");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      setRequests(await listCareRequests({ projectId }));
    } catch (caught) {
      setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load your requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending || !message.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await submitCareRequest({ clientId, projectId, message, category });
      setMessage("");
      setCategory("quick_update");
      await reload();
    } catch (caught) {
      setSendError(caught instanceof AgencyDbError ? caught.message : "Unable to submit this request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Website Care requests</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        A small update, a content change, or something that needs fixing — tell us here and we'll take it from there.
      </p>

      {hasActiveCarePlan ? (
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">What kind of request is this?</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <label className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--client-line)] p-3 has-[:checked]:border-[rgb(0_80_240_/_0.45)] has-[:checked]:bg-[rgb(0_80_240_/_0.04)]">
                <input
                  type="radio"
                  name="care-request-category"
                  value="quick_update"
                  checked={category === "quick_update"}
                  onChange={() => setCategory("quick_update")}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--client-ink)]">A quick update or fix</span>
                  <span className="block text-[12px] text-[var(--client-muted)]">Covered by your Website Care plan.</span>
                </span>
              </label>
              <label className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--client-line)] p-3 has-[:checked]:border-[rgb(0_80_240_/_0.45)] has-[:checked]:bg-[rgb(0_80_240_/_0.04)]">
                <input
                  type="radio"
                  name="care-request-category"
                  value="new_addition"
                  checked={category === "new_addition"}
                  onChange={() => setCategory("new_addition")}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--client-ink)]">Something new I'd like added</span>
                  <span className="block text-[12px] text-[var(--client-muted)]">A new page, feature, or section.</span>
                </span>
              </label>
            </div>
          </fieldset>

          {category === "new_addition" ? (
            <p className="rounded-lg border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] px-3 py-2.5 text-[13px] leading-relaxed text-[#92610a]">
              New additions are usually outside what the Care plan covers and may need a separate quote. Tell us what you
              have in mind and we'll follow up either way.
            </p>
          ) : null}

          <label className="block">
            <span className="sr-only">What would you like us to do?</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={3}
              placeholder="e.g. Update the hours on the Contact page to close at 6pm on weekdays"
              className="w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          {sendError ? (
            <p role="alert" className="text-sm text-[#b45309]">
              {sendError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send request"}
          </button>
        </form>
      ) : (
        <div className="mt-4 rounded-lg border border-[var(--client-line)] bg-[var(--client-bg)] p-4">
          <p className="text-sm text-[var(--client-ink)]">
            Website Care requests are part of the Website Care plan. Choose it below to start sending requests.
          </p>
          <a
            href="#plans"
            className="mt-3 inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
          >
            Choose a plan
          </a>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--client-line)] pt-5">
        <h3 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Your requests</h3>
        {loading ? (
          <div className="mt-3 h-16 animate-pulse rounded-lg bg-[var(--client-bg)]" />
        ) : loadError ? (
          <p className="mt-3 text-sm text-[#b45309]">{loadError}</p>
        ) : requests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">You haven&apos;t sent a request yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="rounded-lg border border-[var(--client-line)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="max-w-md text-sm text-[var(--client-ink)]">{request.message}</p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusToneClass[request.status]}`}
                  >
                    {CARE_REQUEST_STATUS_LABELS[request.status]}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--client-muted)]">
                  {CARE_REQUEST_CATEGORY_LABELS[request.category]} · Sent {formatRequestDate(request.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
