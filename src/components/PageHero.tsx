import type { ReactNode } from "react";
import { AnimateIn } from "@/components/AnimateIn";
import { cn } from "@/lib/cn";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function PageHero({ eyebrow, title, description, children, aside, className }: PageHeroProps) {
  return (
    <header className={cn("border-b border-[var(--color-line)] py-16 md:py-24", className)}>
      <div
        className={cn(
          "container-wide",
          aside ? "grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16" : undefined,
        )}
      >
        <div className="max-w-3xl">
          <AnimateIn>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-5 text-[2.15rem] md:text-[3.25rem]">{title}</h1>
          </AnimateIn>
          {description ? (
            <AnimateIn delay={90}>
              <p className="mt-5 text-lg text-muted">{description}</p>
            </AnimateIn>
          ) : null}
          {children ? <AnimateIn delay={160}>{children}</AnimateIn> : null}
        </div>
        {aside ? (
          <AnimateIn delay={160} variant="scale">
            <div className="min-w-0">{aside}</div>
          </AnimateIn>
        ) : null}
      </div>
    </header>
  );
}
