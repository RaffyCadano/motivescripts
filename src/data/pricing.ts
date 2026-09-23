/**
 * Public-facing pricing. One source for the Pricing page, the homepage pricing
 * section, and the pricing FAQ answer, so the numbers can't drift apart.
 *
 * Deliberately NOT a price list. The only public figure is the starting price for
 * the base website, which matches the default website line in Admin proposals
 * (agency_settings.default_proposal_website_cents). Individual pages, features, and
 * add-ons are priced per project inside the proposal system and are not published
 * here -- if that default is changed in Admin, update `websiteStartingPrice` too.
 */
export const websiteStartingPrice = "$2,500";

/**
 * Starting price for the Growth tier -- unlike Custom, Growth now publishes a floor price. Final
 * price still depends on the added scope (extra pages, forms, integrations), same as Website's
 * starting price. If changed here, change it in supabase/functions/_shared/aiKnowledge.ts too
 * (scripts/test-ai-endpoint.mjs checks they match).
 */
export const growthStartingPrice = "$3,500";

/**
 * Starting price for Website Care, the one ongoing monthly service shown on the Pricing page. This is
 * the public "starting at" figure only: each client's actual plan amount is set when their plan is
 * created in Admin (Recurring plans) and is confirmed in their proposal. If you change it here, change
 * it in supabase/functions/_shared/aiKnowledge.ts too (scripts/test-ai-endpoint.mjs checks they match).
 *
 * This is a static fallback only, shown while the live tier list loads (or if it fails to load) --
 * Website Care itself is tiered (Essential/Business/Pro), fetched live from maintenance_plan_templates
 * on the Pricing page and in the client portal. Keep this equal to the cheapest active tier's price so
 * the fallback never overstates it.
 *
 * Hosting and SEO are not sold as separate ongoing plans -- ongoing hosting is included starting at the
 * Essential tier, and SEO maintenance is included starting at the Pro tier (see the tiers' own
 * included_services in Admin -> Website Care plans).
 */
export const careStartingPrice = "$49";

export const careService = {
  id: "care",
  planType: "care",
  name: "Website Care",
  description:
    "Hosting, updates, technical support, and small content or feature changes after launch, for businesses that want an ongoing relationship rather than a one-time build. Higher tiers add content updates, performance monitoring, and SEO maintenance.",
  price: careStartingPrice,
} as const;

/** Shown under Website Care and repeated in the FAQ, so the terms are stated wherever the price is. */
export const ongoingServicesTerms =
  "Your first 30 days are free, then billed monthly and renews automatically until you cancel. After your website launches you can choose a plan yourself from your client portal at the listed price, and you confirm it on Stripe's secure checkout before anything is charged -- Stripe holds your card but nothing is charged until the trial ends. You can cancel any time from your client portal: canceling during the free month means you're never charged at all, and canceling later means the plan runs to the end of the period you've already paid for and you aren't charged again. Need something different? Ask us about a custom plan.";

export const pricingTiers = [
  {
    id: "website",
    name: "Website",
    tagline: "For businesses that need a professional website.",
    priceLead: "Starting at",
    price: websiteStartingPrice,
    priceNote: "Final price depends on your project's scope and requirements.",
    features: [
      "Homepage, plus pages scoped to your business",
      "Responsive, mobile-first design",
      "Contact form",
      "Basic SEO setup and performance optimization",
      "Launch support",
    ],
    badge: "Base package",
    highlighted: true,
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For projects that need more pages or added functionality.",
    priceLead: "Starting at",
    price: growthStartingPrice,
    priceNote: "Built on the base website. Final price depends on your project's added scope.",
    features: [
      "Additional pages, such as a gallery, FAQ, or locations",
      "Booking, appointment, or quote-request forms",
      "Integrations with other tools, scoped per project",
      "Content structured around your services and inquiries",
    ],
    badge: null,
    highlighted: false,
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "For requirements outside the standard website.",
    priceLead: "Pricing",
    price: "Custom quote",
    priceNote: "Scoped and quoted around your exact requirements.",
    features: [
      "E-commerce or an online store",
      "Customer login or portal features",
      "Complex integrations",
      "Multi-location or multi-brand sites",
    ],
    badge: null,
    highlighted: false,
  },
] as const;

/**
 * A handful of representative examples only -- not the internal feature catalog, and
 * intentionally without prices. Each is scoped and priced in the project proposal.
 */
export const commonAddOns = [
  {
    name: "Booking / appointments",
    description: "Let customers request or book appointments through your website.",
  },
  {
    name: "Online payments",
    description: "Accept payments directly on your site.",
  },
  {
    name: "E-commerce",
    description: "An online store for selling products.",
  },
  {
    name: "Customer login",
    description: "Private, signed-in areas for your customers.",
  },
  {
    name: "Advanced integrations",
    description: "Connect your website to the other tools your business uses.",
  },
] as const;
