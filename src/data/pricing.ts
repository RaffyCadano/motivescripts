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
    priceLead: null,
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
    priceLead: null,
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
