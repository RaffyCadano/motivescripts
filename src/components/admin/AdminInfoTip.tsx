import { useId } from "react";
import { Info } from "lucide-react";

export function AdminInfoTip({ text }: { text: string }) {
  const tipId = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="peer inline-flex size-5 items-center justify-center rounded-full text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]"
        aria-label="More about this field"
        aria-describedby={tipId}
      >
        <Info size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+0.45rem)] z-40 w-56 -translate-x-1/2 rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-3 py-2 text-left text-[12px] font-medium leading-relaxed text-white opacity-0 shadow-[0_10px_24px_rgb(7_17_31_/_0.18)] transition-opacity before:absolute before:bottom-full before:left-1/2 before:-ml-1 before:border-4 before:border-transparent before:border-b-[var(--admin-navy)] peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
