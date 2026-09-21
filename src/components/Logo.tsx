import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  markClassName?: string;
  /** Extra classes for the "MotiveScripts" text, e.g. to size it up in the top nav. */
  wordmarkClassName?: string;
  wordmark?: boolean;
};

export function Logo({ className, markClassName, wordmarkClassName, wordmark = true }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn("inline-flex items-center gap-3 rounded-sm text-ink", className)}
      aria-label="MotiveScripts home"
    >
      <BrandMark className={cn("h-8 w-auto", markClassName)} decorative />
      {wordmark ? (
        <span
          className={cn(
            "font-heading text-sm font-extrabold tracking-tight whitespace-nowrap sm:text-[1.05rem]",
            wordmarkClassName,
          )}
        >
          MotiveScripts
        </span>
      ) : null}
    </Link>
  );
}
