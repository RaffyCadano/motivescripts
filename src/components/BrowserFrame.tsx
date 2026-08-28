import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BrowserFrameProps = {
  children: ReactNode;
  url?: string;
  className?: string;
};

export function BrowserFrame({ children, url = "example.com", className }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[rgb(0_16_48_/_0.34)] p-px shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[calc(var(--radius-lg)-1px)] bg-white">
        <div className="flex items-center gap-3 border-b border-[rgb(0_80_240_/_0.28)] bg-[rgb(0_80_240_/_0.03)] px-3 py-2.5">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-[#c5ccd6]" />
            <span className="size-2 rounded-full bg-[#c5ccd6]" />
            <span className="size-2 rounded-full bg-[#c5ccd6]" />
          </div>
          <p className="min-w-0 flex-1 truncate rounded-full bg-[rgb(0_16_48_/_0.04)] px-3 py-1 text-center font-heading text-[10px] tracking-wide text-faint">
            {url}
          </p>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
