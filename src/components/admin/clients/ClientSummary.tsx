import { useLeads } from "@/components/admin/leads/LeadsProvider";

export function ClientSummary() {
  const { clients, projects } = useLeads();
  const counts = [
    { id: "total", label: "Total Clients", value: clients.length },
    { id: "active", label: "Active Clients", value: clients.filter((item) => item.status === "Active").length },
    { id: "projects", label: "Projects", value: projects.filter((item) => !item.archived).length },
    {
      id: "attention",
      label: "Needs Attention",
      value: clients.filter((item) => item.status === "Inactive").length,
    },
  ];

  return (
    <section aria-label="Client snapshot">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
