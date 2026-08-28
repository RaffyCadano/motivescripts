import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

type ServiceCardProps = {
  title: string;
  body: string;
  index: number;
  href?: string;
};

const icons = [DesignIcon, DevelopIcon, CareIcon, SeoIcon];

export function ServiceCard({ title, body, index, href }: ServiceCardProps) {
  const Icon = icons[index % icons.length];
  const content = (
    <>
      <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[rgb(0_80_240_/_0.08)] text-blue">
        <Icon />
      </span>
      <h3 className="mt-6 text-xl font-bold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </>
  );

  const className = cn(
    "group relative flex h-full w-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6 md:p-7",
    "transition-[border-color,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]",
    "hover:-translate-y-0.5 hover:border-[rgb(0_200_255_/_0.28)]",
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {content}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#00C8FF,transparent)] opacity-0 transition-opacity duration-[var(--duration-base)] group-hover:opacity-100" />
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

function DesignIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 12.5h14" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6" cy="7" r="1.3" fill="currentColor" />
    </svg>
  );
}

function DevelopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M6.5 5 3 9l3.5 4M11.5 5 15 9l-3.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 9v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
    </svg>
  );
}

function SeoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="m11.5 11.5 3.2 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
