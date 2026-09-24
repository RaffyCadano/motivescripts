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
  /** Centers the eyebrow, title, and description instead of left-aligning them. Ignored when there is an aside. */
  centered?: boolean;
  /** Hides the small accent dash the eyebrow label normally has before it. */
  plainEyebrow?: boolean;
};

export function PageHero({ eyebrow, title, description, children, aside, className, centered, plainEyebrow }: PageHeroProps) {
  return (
    <header className={cn("border-b border-[var(--color-line)] py-16 md:py-24", className)}>
      <div
        className={cn(
          "container-wide",
          aside ? "grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16" : undefined,
        )}
      >
        <div className={cn("max-w-3xl", centered && !aside && "mx-auto text-center")}>
          <AnimateIn>
            <p className={cn("eyebrow", plainEyebrow && "eyebrow--plain")}>{eyebrow}</p>
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
