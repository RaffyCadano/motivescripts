/**
 * Public-facing engagement tiers. No public price list exists yet, so this ships as
 * a clean structure (no invented dollar amounts) that can accept real pricing later —
 * every project is scoped and quoted individually in the meantime.
 */
export const pricingTiers = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For businesses that need a professional online presence.",
    price: "Custom quote",
    features: [
      "A focused, single-purpose website",
      "Mobile-first, responsive design",
      "Core pages: home, services, contact",
      "Launch-ready in a few weeks",
    ],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For businesses looking to generate more leads and inquiries.",
    price: "Custom quote",
    features: [
      "A full multi-page website",
      "Content structured around conversion",
      "SEO and performance fundamentals",
      "Room for a blog, gallery, or booking flow",
    ],
    highlighted: true,
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "For businesses with more advanced requirements.",
    price: "Custom quote",
    features: [
      "Custom features and integrations",
      "E-commerce or booking systems",
      "Multi-location or multi-brand sites",
      "Scoped around your exact requirements",
    ],
    highlighted: false,
  },
] as const;
