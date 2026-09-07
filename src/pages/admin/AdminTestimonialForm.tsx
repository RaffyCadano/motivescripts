import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { emptyTestimonialDraft, type TestimonialDraft } from "@/data/testimonials";
import {
  fetchTestimonial,
  insertTestimonial,
  updateTestimonial,
} from "@/data/testimonialsRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

export function AdminTestimonialForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { projects } = useLeads();
  const [draft, setDraft] = useState<TestimonialDraft>(emptyTestimonialDraft);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void fetchTestimonial(id)
      .then((row) => {
        if (!active || !row) return;
        setDraft({
          clientName: row.clientName,
          roleTitle: row.roleTitle,
          quote: row.quote,
          projectId: row.projectId,
          published: row.published,
          displayOrder: row.displayOrder,
        });
      })
      .catch((caught) => {
        if (active) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this testimonial.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !draft.clientName.trim() || !draft.quote.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (id) await updateTestimonial(id, draft);
      else await insertTestimonial(draft);
      navigate("/admin/testimonials");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save this testimonial.");
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/testimonials" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Testimonials
      </Link>
      <AdminPageHeader
        title={editing ? "Edit Testimonial" : "Add Testimonial"}
        description="Testimonials only appear on the public site once published."
      />

      <form
        className="w-full max-w-2xl space-y-5 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
        onSubmit={onSubmit}
      >
        <Field label="Client name">
          <input
            value={draft.clientName}
            onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))}
            required
            className={fieldClass}
          />
        </Field>
        <Field label="Role / business" optional>
          <input
            value={draft.roleTitle}
            onChange={(event) => setDraft((current) => ({ ...current, roleTitle: event.target.value }))}
            placeholder="e.g. Owner, Evergreen Grounds"
            className={fieldClass}
          />
        </Field>
        <Field label="Quote">
          <textarea
            rows={4}
            value={draft.quote}
            onChange={(event) => setDraft((current) => ({ ...current, quote: event.target.value }))}
            required
            className={fieldClass}
          />
        </Field>
        <Field label="Project" optional hint="Optionally link this testimonial to the project it's about.">
          <select
            value={draft.projectId ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value || null }))}
            className={fieldClass}
          >
            <option value="">No project linked</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Display order" optional hint="Lower numbers appear first.">
          <input
            type="number"
            value={draft.displayOrder}
            onChange={(event) => setDraft((current) => ({ ...current, displayOrder: Number(event.target.value) || 0 }))}
            className={fieldClass}
          />
        </Field>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-3">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))}
            className="h-4 w-4"
          />
          <span className="text-sm text-[var(--admin-ink)]">Published — visible on the public site</span>
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--admin-line)] pt-5 sm:flex-row sm:justify-end">
          <Link to="/admin/testimonials" className={`${adminGhostBtn} justify-center`}>
            Cancel
          </Link>
          <button type="submit" disabled={busy} className={`${adminPrimaryBtn} justify-center`}>
            {busy ? "Saving…" : editing ? "Save Changes" : "Add Testimonial"}
          </button>
        </div>
      </form>
    </div>
  );
}

const fieldClass = cn(
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]",
);

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--admin-ink)]">
        {label}
        {optional ? <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs font-normal text-[var(--admin-muted)]">{hint}</p> : null}
    </div>
  );
}
