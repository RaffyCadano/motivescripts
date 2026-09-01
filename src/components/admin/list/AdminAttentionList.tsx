import { Link } from "react-router-dom";
import { adminSoftBtn } from "@/components/admin/adminActionStyles";

export type AdminAttentionItem = {
  id: string;
  name: string;
  body: string;
  href: string;
  label: string;
  nameHref?: string;
};

export function AdminAttentionList({ items }: { items: AdminAttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-3.5">
      <h2 className="font-heading text-sm font-semibold tracking-tight">Needs Your Attention</h2>
      <ul className="mt-2.5 space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link
                to={item.nameHref ?? item.href}
                className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
              >
                {item.name}
              </Link>
              <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{item.body}</p>
            </div>
            <Link to={item.href} className={`${adminSoftBtn} h-9 shrink-0 justify-center px-3 text-[12px]`}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
