import { useId } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

export function AdminInfoTip({
  text,
  label = "More about this field",
  wide = false,
}: {
  text: string;
  label?: string;
  wide?: boolean;
}) {
  const tipId = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="peer inline-flex size-5 items-center justify-center rounded-full text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]"
        aria-label={label}
        aria-describedby={tipId}
      >
        <Info size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute top-[calc(100%+0.45rem)] z-40 rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-3 py-2 text-left text-[12px] font-medium leading-relaxed text-white opacity-0 shadow-[0_10px_24px_rgb(7_17_31_/_0.18)] transition-opacity before:absolute before:bottom-full before:border-4 before:border-transparent before:border-b-[var(--admin-navy)] peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100",
          wide
            ? "left-0 w-80 max-w-[min(20rem,calc(100vw-2rem))] before:left-3"
            : "left-1/2 w-56 -translate-x-1/2 before:left-1/2 before:-ml-1",
        )}
      >
        {text}
      </span>
    </span>
  );
}
