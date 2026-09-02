import {
  projectSectionNavGroups,
  type ProjectSectionTabId,
} from "@/data/projectSectionNav";
import { cn } from "@/lib/cn";

type ProjectSectionNavProps = {
  tab: ProjectSectionTabId;
  taskCount?: number;
  onSelect: (tab: ProjectSectionTabId) => void;
};

export function ProjectSectionNav({ tab, taskCount = 0, onSelect }: ProjectSectionNavProps) {
  return (
    <>
      <label className="block text-sm font-semibold text-[var(--admin-ink)] lg:hidden">
        Section
        <select
          value={tab}
          onChange={(event) => onSelect(event.target.value as ProjectSectionTabId)}
          className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
        >
          {projectSectionNavGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.id === "tasks" && taskCount > 0 ? ` (${taskCount})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <nav
        aria-label="Project sections"
        className="hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-3 lg:sticky lg:top-0 lg:block lg:self-start"
      >
        {projectSectionNavGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                const badge = item.id === "tasks" ? taskCount : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium tracking-tight",
                      active
                        ? "bg-[var(--admin-hover)] text-[var(--admin-blue)]"
                        : "text-[var(--admin-ink)]/75 hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]",
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className={active ? "text-[var(--admin-blue)]" : "text-[var(--admin-muted)]"}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {badge > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-blue)] px-1.5 text-[10px] font-semibold text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
