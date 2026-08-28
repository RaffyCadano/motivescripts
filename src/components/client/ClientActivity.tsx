import { CheckCircle2, FileUp, RefreshCw, Sparkles } from "lucide-react";
import type { ClientActivityItem } from "@/data/clientPortal";

const icons = {
  upload: FileUp,
  approval: CheckCircle2,
  update: Sparkles,
  status: RefreshCw,
} as const;

type ClientActivityProps = {
  items: ClientActivityItem[];
};

export function ClientActivity({ items }: ClientActivityProps) {
  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]">
      <div className="border-b border-[var(--client-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Recent Activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--client-muted)]">No activity yet.</p>
      ) : (
        <ol className="divide-y divide-[var(--client-line)]">
          {items.map((item) => {
            const Icon = icons[item.icon];
            return (
              <li key={item.id} className="flex gap-3 px-5 py-4">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--client-hover)] text-[var(--client-blue)]">
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--client-ink)]">{item.description}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--client-muted)]">
                    <time>{item.time}</time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
