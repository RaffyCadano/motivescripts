import { pricingTiers } from "@/data/pricing";
import { projectPackageLabels, type ProjectPackage } from "@/data/projectPackages";
import { cn } from "@/lib/cn";

/**
 * "Which package fits you?" on the Website Scope form. The same three packages as the Pricing page, plus
 * "Not sure yet". It is the client's request: staff confirm the package (and price) when they create the
 * project, and that is what changes the portal, so the copy says so.
 */
export function ScopePackageChooser({
  value,
  answered,
  invalid,
  onChange,
  hint,
}: {
  value: ProjectPackage | null;
  /** False until the client has picked something, so "Not sure yet" is not pre-selected for them. */
  answered: boolean;
  /** They tried to continue without choosing. */
  invalid: boolean;
  onChange: (next: ProjectPackage | null) => void;
  hint: string | null;
}) {
  return (
    <fieldset aria-required="true" aria-invalid={invalid || undefined}>
      <legend className="sr-only">Which package fits you? Required.</legend>

      <div className="grid gap-3 sm:grid-cols-3">
        {pricingTiers.map((tier) => {
          const selected = value === tier.id;
          return (
            <label key={tier.id} className="block cursor-pointer">
              <input
                type="radio"
                name="scope-package"
                value={tier.id}
                checked={answered && selected}
                onChange={() => onChange(tier.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-full flex-col rounded-[var(--client-radius)] border bg-white p-4 transition-colors",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--client-blue)]",
                  selected
                    ? "border-[var(--client-blue)] bg-[rgb(0_80_240_/_0.04)] shadow-[0_0_0_1px_var(--client-blue)]"
                    : "border-[var(--client-line)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--client-hover)]",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-heading text-base font-semibold text-[var(--client-ink)]">{projectPackageLabels[tier.id]}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                      selected ? "border-[var(--client-blue)] bg-[var(--client-blue)] text-white" : "border-[var(--client-line)] text-transparent",
                    )}
                  >
                    ✓
                  </span>
                </span>
                <span className="mt-1 font-heading text-sm font-semibold text-[var(--client-blue)]">
                  {tier.price.startsWith("$") ? `Starting at ${tier.price}` : tier.price}
                </span>
                <span className="mt-2 text-[12px] leading-relaxed text-[var(--client-muted)]">{tier.tagline}</span>
                <ul className="mt-3 space-y-1.5 text-[12px] text-[var(--client-ink)]">
                  {tier.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="text-[var(--client-blue)]">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </span>
            </label>
          );
        })}
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--client-ink)]">
        <input
          type="radio"
          name="scope-package"
          value=""
          checked={answered && value === null}
          onChange={() => onChange(null)}
          className="size-4 accent-[var(--client-blue)]"
        />
        Not sure yet. Recommend one for me.
      </label>

      {invalid && !answered ? (
        <p className="mt-3 text-[13px] font-medium text-red-700" role="alert">
          Choose a package, or select “Not sure yet”, to continue.
        </p>
      ) : null}

      {hint ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-950" role="status">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
