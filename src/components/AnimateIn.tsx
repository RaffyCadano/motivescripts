import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AnimateInVariant = "up" | "fade" | "scale" | "left" | "right";

/** The delay step used for staggering a grid or list of AnimateIns, e.g. `delay={index * STAGGER_STEP}`. */
export const STAGGER_STEP = 70;

type AnimateInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Which entrance to play: fade-up (default), a plain fade, a small scale-in, or slide from a side. */
  variant?: AnimateInVariant;
  /** @deprecated pass `variant` instead (kept so any old "left"/"up" caller keeps compiling). */
  direction?: "up" | "left";
};

const pendingClassName: Record<AnimateInVariant, string> = {
  up: "anim-pending",
  fade: "anim-pending-fade",
  scale: "anim-pending-scale",
  left: "anim-pending-left",
  right: "anim-pending-right",
};

export function AnimateIn({ children, className, delay = 0, variant, direction }: AnimateInProps) {
  const resolved = variant ?? direction ?? "up";
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const show = () => setVisible(true);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(visible ? "anim-in" : pendingClassName[resolved], className)}
      style={{ transitionDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
