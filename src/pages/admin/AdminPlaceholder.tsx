import { useLocation } from "react-router-dom";
import { getAdminPageMeta } from "@/data/adminNav";

export function AdminPlaceholder() {
  const { pathname } = useLocation();
  const page = getAdminPageMeta(pathname);

  return (
    <div>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{page.label}</h1>
      <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">
        This section is a placeholder. Workflows and live data will connect in a later phase — the
        layout is ready so we don’t rebuild the dashboard later.
      </p>
      <div className="mt-8 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-sm text-[var(--admin-muted)]">
        No records to show yet. Demonstration data will live here after the backend is connected.
      </div>
    </div>
  );
}
