import { Link } from "react-router-dom";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/** "Projects / Website Redesign / Build Gallery / Portfolio page" -- every item but the last is a link. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-[var(--admin-muted)]">/</span> : null}
            {item.href && !isLast ? (
              <Link to={item.href} className="text-[var(--admin-blue)] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-[var(--admin-muted)]" : "text-[var(--admin-blue)]"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
