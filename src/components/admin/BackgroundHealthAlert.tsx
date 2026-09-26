import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TriangleAlert } from "lucide-react";
import { groupFailures, hasBackgroundProblems, jobLabel, parseBackgroundHealth, type BackgroundHealth } from "@/data/backgroundHealth";
import { formatLeadTimestamp } from "@/data/leads";
import { getSupabase } from "@/lib/supabase";

/**
 * Admins only: shown when a scheduled job (reminder emails, backups, uptime checks) has failed in the last week, or
 * calls to edge functions have been failing. Renders nothing when all is well, or when the check itself can't run.
 */
export function BackgroundHealthAlert() {
  const [health, setHealth] = useState<BackgroundHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = getSupabase() as SupabaseClient | null;
    if (!client) return;
    void client
      .rpc("admin_background_health")
      .then(({ data, error }) => {
        if (!cancelled && !error) setHealth(parseBackgroundHealth(data));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health || !hasBackgroundProblems(health)) return null;
  const groups = groupFailures(health.failures);

  return (
    <section
      aria-label="Background jobs need attention"
      className="rounded-[var(--admin-radius)] border border-amber-200 bg-amber-50 p-4 md:p-5"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-[#b45309]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-semibold text-[#92400e]">Something in the background needs a look</h2>
          {groups.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {groups.map((group) => (
                <li key={group.job} className="text-[13px] text-[#78350f]">
                  <span className="font-semibold">{jobLabel(group.job)}</span> failed
                  {group.count > 1 ? ` ${group.count} times` : ""}, last on {formatLeadTimestamp(group.latest.createdAt)}
                  {group.latest.message ? <span className="block truncate text-[12px] text-[#a16207]">{group.latest.message}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {health.failedCalls24h > 0 ? (
            <p className="mt-2 text-[13px] text-[#78350f]">
              {health.failedCalls24h} email or backup {health.failedCalls24h === 1 ? "request" : "requests"} didn’t get a successful answer in
              the last 24 hours. Reminders or alerts may not have been sent.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
