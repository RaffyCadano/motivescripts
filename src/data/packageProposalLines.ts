import type { LineItemDraft } from "@/data/documents";
import { growthStartingPrice } from "@/data/pricing";
import { proposalLineDescription } from "@/data/proposalPresets";
import type { ProjectPackage } from "@/data/projectPackages";

function centsFromPrice(price: string): number {
  return Number(price.replace(/[^0-9]/g, "")) * 100;
}

/**
 * The starting line items for a proposal on a project of this package, mirroring the Pricing page:
 *   Website: the base website at the default price.
 *   Growth:  the website at the Growth starting price, and the domain included for the first year.
 *   Custom:  a custom-website line for staff to price, with the domain and business email included.
 * Staff can edit every line; this only saves starting from a blank draft. "Included" lines are $0.
 * (The Custom line is not named "Website" on purpose: a $0 "Website" line is auto-filled with the
 * default website price.)
 */
export function packageProposalLineItems(pkg: ProjectPackage, websiteCents: number): LineItemDraft[] {
  const item = (name: string, description: string, unitPriceCents: number): LineItemDraft => ({
    key: `item-${crypto.randomUUID()}`,
    name,
    description,
    quantity: 1,
    unitPriceCents,
  });
  switch (pkg) {
    case "website":
      return [item("Website", proposalLineDescription("Website"), websiteCents)];
    case "growth":
      return [
        item(
          "Website",
          "Growth package: additional pages, booking or quote-request forms, and integrations scoped to your project.",
          Math.max(websiteCents, centsFromPrice(growthStartingPrice)),
        ),
        item("Domain", "Domain name registration or connection. Included for the first year with the Growth package.", 0),
      ];
    case "custom":
      return [
        item("Custom website", "Custom package: scoped and priced around your exact requirements.", 0),
        item("Domain", "Domain name registration or connection. Included with the Custom package.", 0),
        item("Business Email", "Professional email set up on the business domain. Included with the Custom package.", 0),
      ];
  }
}
