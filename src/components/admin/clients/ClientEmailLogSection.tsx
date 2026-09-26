import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import type { AgencyClient } from "@/data/agencyClients";
import { clientEmailLabel, type ClientEmailLogEntry } from "@/data/clientEmailLog";
import { listClientEmailLog } from "@/data/clientEmailLogRepository";
import { AgencyDbError } from "@/lib/dbErrors";

function formatSent(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The automated emails this client was sent (reminders and notices), as proof of what they were told and when. */
export function ClientEmailLogSection({ client }: { client: AgencyClient }) {
  const [entries, setEntries] = useState<ClientEmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listClientEmailLog(client.id)
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load the reminder emails.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  return (
    <section id="reminder-emails" className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
          <MailCheck size={15} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Reminder emails</h2>
          <p className="text-[12px] text-[var(--admin-muted)]">
            Automated emails sent to this client, who received each one, and when. Use the message ID to check delivery with the email provider.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : error ? (
        <p className="mt-4 text-sm text-[#b45309]">{error}</p>
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-6 text-center text-sm text-[var(--admin-muted)]">
          No reminder emails have been sent to this client yet.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--admin-line)] rounded-lg border border-[var(--admin-line)]">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="inline-flex rounded-full bg-[rgb(0_80_240_/_0.08)] px-2.5 py-0.5 font-heading text-[12px] font-semibold text-[var(--admin-blue)]">
                  {clientEmailLabel(entry.kind, entry.stage)}
                </span>
                <time dateTime={entry.createdAt} className="text-[12px] text-[var(--admin-muted)]">
                  {formatSent(entry.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-[var(--admin-ink)]">{entry.subject}</p>
              <p className="mt-0.5 break-words text-[12px] text-[var(--admin-muted)]">
                Sent to {entry.recipients.length > 0 ? entry.recipients.join(", ") : "—"}
              </p>
              {entry.providerId ? (
                <p className="mt-0.5 break-all font-mono text-[11px] text-[var(--admin-muted)]">Message ID: {entry.providerId}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
