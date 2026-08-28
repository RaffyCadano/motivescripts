import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
};

export function Logo({ className, markClassName, wordmark = true }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn("inline-flex items-center gap-3 rounded-sm text-ink", className)}
      aria-label="MotiveScripts home"
    >
      <BrandMark className={cn("h-8 w-auto", markClassName)} decorative />
      {wordmark ? (
        <span className="font-heading text-sm font-extrabold tracking-tight whitespace-nowrap sm:text-[1.05rem]">
          MotiveScripts
        </span>
      ) : null}
    </Link>
  );
}
