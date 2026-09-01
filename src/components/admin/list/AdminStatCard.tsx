import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export function AdminStatGrid({
  columns = 4,
  children,
}: {
  columns?: 2 | 4 | 5 | 6;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5",
        columns === 2 && "sm:grid-cols-2",
        columns === 4 && "sm:grid-cols-2 xl:grid-cols-4",
        columns === 5 && "sm:grid-cols-3 xl:grid-cols-5",
        columns === 6 && "sm:grid-cols-3 xl:grid-cols-6",
      )}
    >
      {children}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  active = false,
  secondary = false,
  href,
  onClick,
}: {
  label: string;
  value: string | number;
  active?: boolean;
  secondary?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "rounded-[var(--admin-radius)] border bg-[var(--admin-card)] text-left transition-colors",
    secondary ? "px-4 py-2.5" : "px-4 py-2.5",
    active
      ? "border-[rgb(0_80_240_/_0.35)] ring-1 ring-[rgb(0_80_240_/_0.16)]"
      : "border-[var(--admin-line)] hover:border-[rgb(0_80_240_/_0.18)]",
  );
  const body = (
    <>
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-heading font-semibold tracking-tight text-[var(--admin-ink)]",
          secondary ? "text-xl" : "text-[1.5rem]",
        )}
      >
        {value}
      </p>
    </>
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
