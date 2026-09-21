import { useId } from "react";
import { extraRecipientsError, MAX_EXTRA_RECIPIENTS, type ExtraRecipients } from "@/data/emailRecipients";
import { cn } from "@/lib/cn";

type ExtraRecipientsFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Result of parseExtraRecipients(value, ...) computed by the parent, which also uses it to send. */
  parsed: ExtraRecipients;
  disabled?: boolean;
};

/**
 * "Also send a copy to" for invoice emails. The client's own contacts always still receive the invoice;
 * addresses added here are copied (CC), so everyone on the email can see them.
 */
export function ExtraRecipientsField({ value, onChange, parsed, disabled }: ExtraRecipientsFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const error = extraRecipientsError(parsed);

  return (
    <div>
      <label htmlFor={id} className="text-[12px] font-semibold text-[var(--admin-ink)]">
        Also send a copy to <span className="font-normal text-[var(--admin-muted)]">(optional)</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="email"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        placeholder="accountant@example.com, you@motivescripts.com"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintId}
        className={cn(
          "mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:opacity-60",
          error ? "border-[#b42318]" : "border-[var(--admin-line)]",
        )}
      />
      <p
        id={hintId}
        role={error ? "alert" : undefined}
        className={cn("mt-1.5 text-[12px]", error ? "text-[#b42318]" : "text-[var(--admin-muted)]")}
      >
        {error ??
          (parsed.emails.length > 0
            ? `A copy will also go to ${parsed.emails.join(", ")}. Everyone on the email can see these addresses.`
            : `The client still receives the invoice. Add up to ${MAX_EXTRA_RECIPIENTS} addresses, separated by commas, to copy others.`)}
      </p>
    </div>
  );
}
