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
 * Starting prices for the optional monthly services, shown on the Pricing page. These are the public
 * "starting at" figures only: each client's actual plan amount is set when their plan is created in Admin
 * (Recurring plans) and is confirmed in their proposal. If you change one here, change it in
 * supabase/functions/_shared/aiKnowledge.ts too (scripts/test-ai-endpoint.mjs checks they match).
 */
export const careStartingPrice = "$99";
export const hostingStartingPrice = "$25";
export const seoRetainerStartingPrice = "$299";

export const ongoingServices = [
  {
    id: "care",
    planType: "care",
    name: "Website Care",
    description:
      "Updates, technical support, and small content or feature changes after launch, for businesses that want an ongoing relationship rather than a one-time build.",
    price: careStartingPrice,
  },
  {
    id: "hosting",
    planType: "hosting",
    name: "Hosting",
    description: "Ongoing hosting for your website, billed monthly. Initial hosting setup is quoted separately in your proposal.",
    price: hostingStartingPrice,
  },
  {
    id: "seo",
    planType: "seo_retainer",
    name: "SEO Retainer",
    description: "Ongoing search engine optimization work after launch.",
    price: seoRetainerStartingPrice,
  },
] as const;

/** Shown under the ongoing services and repeated in the FAQ, so the terms are stated wherever the prices are. */
export const ongoingServicesTerms =
  "Billed monthly and renews automatically until you cancel. After your website launches you can choose a plan yourself from your client portal at the listed price, and you confirm it on Stripe's secure checkout before anything is charged. You can cancel any time from your client portal: the plan then runs to the end of the period you've already paid for and you aren't charged again. Need something different? Ask us about a custom plan.";

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
    priceLead: "Pricing",
    price: "Quoted to scope",
    priceNote: "Built on the base website, with the extra scope priced in your proposal.",
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
