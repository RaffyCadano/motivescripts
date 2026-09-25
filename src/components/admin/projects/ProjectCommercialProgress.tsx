import { AdminProgressPill, AdminStepTrack, type AdminStep } from "@/components/admin/projects/AdminStepTrack";
import { adminFunnelCurrentId, type AdminFunnelItem } from "@/data/preProject";

/** Client to Start: how far the deal has got (portal, scope, project, proposal, contract, invoice). */
export function ProjectCommercialProgress({ items, loading }: { items: AdminFunnelItem[] | null; loading: boolean }) {
  if (loading || !items) {
    return <div className="h-24 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }

  const currentId = adminFunnelCurrentId(items);
  const steps: AdminStep[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    state: item.done ? "done" : item.id === currentId ? "current" : "upcoming",
  }));

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Commercial progress</h2>
        <AdminProgressPill done={items.filter((item) => item.done).length} total={items.length} />
      </div>
      <div className="mt-4">
        <AdminStepTrack steps={steps} />
      </div>
    </section>
  );
}
