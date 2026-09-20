import { cn } from "@/lib/cn";

type TierPriceProps = {
  /** Small lead-in above a numeric price, e.g. "Starting at". Omit for text-only prices. */
  lead: string | null;
  price: string;
  note: string;
  className?: string;
};

/**
 * Price block shared by the Pricing page and the homepage pricing section: lead-in,
 * price, then a scope note. Fixed line heights keep the feature lists in side-by-side
 * cards starting at the same height whether a tier shows an amount or plain text.
 */
export function TierPrice({ lead, price, note, className }: TierPriceProps) {
  const isAmount = price.startsWith("$");
  return (
    <div className={className}>
      <p className="h-4 text-xs font-medium uppercase tracking-[0.12em] text-faint">
        {lead ?? <span aria-hidden="true">&nbsp;</span>}
      </p>
      <p
        className={cn(
          "mt-1 flex h-10 items-center font-heading font-bold tracking-tight text-ink",
          isAmount ? "text-4xl" : "text-xl",
        )}
      >
        {price}
      </p>
      <p className="mt-1.5 min-h-10 text-[0.8125rem] leading-relaxed text-muted">{note}</p>
    </div>
  );
}
