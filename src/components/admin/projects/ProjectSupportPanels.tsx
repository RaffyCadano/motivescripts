import { Flag, FolderKanban, MessageSquareQuote, RefreshCw, SquareCheck, Upload } from "lucide-react";
import { formatProjectDate, formatProjectTimestamp, type AgencyProject } from "@/data/agencyProjects";

const icons = {
  created: FolderKanban,
  status: RefreshCw,
  task: SquareCheck,
  milestone: Flag,
  file: Upload,
  progress: RefreshCw,
  review: MessageSquareQuote,
} as const;

export function ProjectActivityPanel({ project }: { project: AgencyProject }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Activity</h2>
      {project.activity.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No activity yet</p>
      ) : (
        <ol className="mt-5 space-y-0">
          {project.activity.map((item, index) => {
            const Icon = icons[item.icon];
            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[var(--admin-hover)] text-[var(--admin-blue)]">
                    <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  {index < project.activity.length - 1 ? (
                    <span className="w-px flex-1 bg-[var(--admin-line)]" aria-hidden="true" />
                  ) : null}
                </div>
                <div className="pb-5">
                  <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                    {formatProjectDate(item.createdAt)} · {formatProjectTimestamp(item.createdAt)}
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
