import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { projectStatuses } from "@/data/agencyProjects";

export function ProjectSummary() {
  const { projects } = useLeads();
  const active = projects.filter((item) => !item.archived);
  const counts = [
    { id: "total", label: "Total Projects", value: active.length },
    ...projectStatuses.map((status) => ({
      id: status,
      label: status,
      value: active.filter((item) => item.status === status).length,
    })),
  ];

  return (
    <section aria-label="Project snapshot">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {counts.map((item) => (
          <article
            key={item.id}
            className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3"
          >
            <p className="text-[12px] text-[var(--admin-muted)]">{item.label}</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--admin-ink)]">
              {item.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
