import mark from "@/assets/brand/icon.png";
import { cn } from "@/lib/cn";

type BrandMarkProps = {
  className?: string;
  decorative?: boolean;
};

export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    <img
      src={mark}
      alt={decorative ? "" : "MotiveScripts"}
      width={49}
      height={51}
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
