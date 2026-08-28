import { useLocation } from "react-router-dom";
import { adminUnavailablePages, getAdminPageMeta } from "@/data/adminNav";

export function AdminPlaceholder() {
  const { pathname } = useLocation();
  const page = getAdminPageMeta(pathname);
  const copy = adminUnavailablePages[pathname];

  return (
    <div>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{page.label}</h1>
      <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">
        {copy?.description ?? "This section is not available in this release."}
      </p>
      <div className="mt-8 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-sm text-[var(--admin-muted)]">
        {copy?.hint ?? "Use the sidebar to open a live workspace area."}
      </div>
    </div>
  );
}
