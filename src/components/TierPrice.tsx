import { cn } from "@/lib/cn";

type TierPriceProps = {
  /** Small label above the price, e.g. "Starting at" or "Pricing". */
  lead: string;
  price: string;
  note: string;
  className?: string;
};

/**
 * Price block shared by the Pricing page and the homepage pricing section: a small
 * label, the price, then a scope note. An amount ("$2,500") is set large; text prices
 * ("Quoted to scope") are set smaller and sit under a "Pricing" label so they don't read
 * like a second card title. Fixed heights keep the feature lists in side-by-side cards
 * starting at the same height either way.
 */
export function TierPrice({ lead, price, note, className }: TierPriceProps) {
  const isAmount = price.startsWith("$");
  return (
    <div className={className}>
      <p className="text-[0.6875rem] font-semibold uppercase leading-none tracking-[0.14em] text-faint">{lead}</p>
      <p
        className={cn(
          "mt-3 flex h-11 items-center font-heading font-bold leading-none tracking-tight text-ink",
          isAmount ? "text-[2.5rem]" : "text-lg",
        )}
      >
        {price}
      </p>
      <p className="mt-3 min-h-[2.625rem] text-[0.8125rem] leading-relaxed text-muted">{note}</p>
    </div>
  );
}
