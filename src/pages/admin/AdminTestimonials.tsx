import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { adminBlueBtn } from "@/components/admin/adminActionStyles";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { Pencil, Trash2 } from "lucide-react";
import { deleteTestimonial, fetchAllTestimonials } from "@/data/testimonialsRepository";
import type { Testimonial } from "@/data/testimonials";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminTestimonials() {
  const { profile } = useAuth();
  const isAdmin = isActiveAdmin(profile);
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!isAdmin) return;
    try {
      setRows(await fetchAllTestimonials());
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load testimonials.");
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Testimonials</h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">You don’t have access to this section.</p>
        <div className="mt-8 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-sm text-[var(--admin-muted)]">
          Managing public testimonials is visible to administrators only.
        </div>
      </div>
    );
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this testimonial? This cannot be undone.")) return;
    try {
      await deleteTestimonial(id);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this testimonial.");
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Testimonials"
        description="Curate client testimonials shown on the public marketing site."
        action={
          <Link to="/admin/testimonials/new" className={`${adminBlueBtn} justify-center`}>
            + Add Testimonial
          </Link>
        }
      />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No testimonials yet"
          body="Add a testimonial to feature it on the homepage. It stays hidden from the public site until you publish it."
          action={
            <Link to="/admin/testimonials/new" className={`${adminBlueBtn} justify-center`}>
              Add Testimonial
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const items: AdminActionsMenuItem[] = [
              { id: "edit", label: "Edit", icon: Pencil, href: `/admin/testimonials/${row.id}` },
              { id: "delete", label: "Delete", icon: Trash2, onSelect: () => void onDelete(row.id), danger: true },
            ];
            return (
              <li key={row.id} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{row.clientName}</p>
                      {row.roleTitle ? <p className="text-[12px] text-[var(--admin-muted)]">{row.roleTitle}</p> : null}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold ${
                          row.published
                            ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]"
                            : "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                        }`}
                      >
                        {row.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--admin-ink)]">“{row.quote}”</p>
                  </div>
                  <AdminActionsMenu ariaLabel={`Actions for ${row.clientName}`} iconOnly items={items} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
