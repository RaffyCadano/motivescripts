/**
 * Public marketing case studies for the Work / Case Study pages.
 * These are labeled demonstration concepts. They are not CRM records and are
 * never used as Admin/Client fallbacks when Supabase is empty.
 */

export type Project = {
  slug: string;
  name: string;
  industry: string;
  services: string;
  summary: string;
  concept: true;
  accent: string;
  preview: "trees" | "landscape" | "cleaning" | "auto" | "electric";
  challenge: string;
  approach: string[];
  outcome: string;
};

export const projects: Project[] = [
  {
    slug: "live-oak-tree-co",
    name: "Live Oak Tree Co.",
    industry: "Tree Services",
    services: "Website Design / Development",
    summary:
      "A service-first website for a tree company — built to explain the work, show the service area, and make it easy to request a quote.",
    concept: true,
    accent: "#1f6b3a",
    preview: "trees",
    challenge:
      "Tree service companies often get calls from people who still don't know what is offered, where the crew works, or how to ask for a quote. The site has to answer those questions quickly on a phone.",
    approach: [
      "Lead with the services people search for: removal, trimming, and storm work.",
      "Make quote requests the primary action on every key page.",
      "Keep the layout simple enough for a homeowner to scan in under a minute.",
    ],
    outcome:
      "A clear service website with a direct path from the homepage to a quote request. This is a concept project used to show our approach for home-service businesses.",
  },
  {
    slug: "ridge-and-co",
    name: "Ridge & Co.",
    industry: "Landscaping",
    services: "Website Design / Development / SEO",
    summary:
      "An editorial site for a landscaping company, organized around outdoor services, seasonal work, and project inquiries.",
    concept: true,
    accent: "#5b7a4a",
    preview: "landscape",
    challenge:
      "Landscaping work is visual, but the website still has to explain scope, seasonality, and how to start a project without turning into a photo dump.",
    approach: [
      "Group work into services customers recognize: gardens, hardscape, and ongoing care.",
      "Use large project frames instead of a cluttered gallery.",
      "Structure pages so search engines can understand each service area.",
    ],
    outcome:
      "A calmer, more premium landscaping site that still points visitors toward an inquiry. Labeled as a concept, not a client engagement.",
  },
  {
    slug: "marlow-cleaning",
    name: "Marlow Cleaning Co.",
    industry: "Cleaning Services",
    services: "Website Design / Development",
    summary:
      "A clean, conversion-focused site for a residential and commercial cleaning company, with clear packages and a simple booking path.",
    concept: true,
    accent: "#2a6fb6",
    preview: "cleaning",
    challenge:
      "Cleaning companies compete on trust and convenience. Visitors need to see the difference between packages and book without calling first.",
    approach: [
      "Separate residential and commercial paths without duplicating the whole site.",
      "Show package options in plain language.",
      "Keep booking and contact actions visible on mobile.",
    ],
    outcome:
      "A straightforward cleaning website designed around packages and scheduling. This is a demonstration project.",
  },
  {
    slug: "northline-auto",
    name: "Northline Auto",
    industry: "Auto Repair",
    services: "Website Design / Development",
    summary:
      "A trustworthy digital storefront for an auto shop — services, hours, and a direct line to schedule work.",
    concept: true,
    accent: "#c45c2a",
    preview: "auto",
    challenge:
      "Auto shops need a website that feels current and practical: hours, services, and a way to schedule — not a brochure that hides the phone number.",
    approach: [
      "Put hours, location, and scheduling in easy reach.",
      "List services the way customers search for them.",
      "Use a restrained visual system that feels like a real shop, not a template.",
    ],
    outcome:
      "A compact auto-service site built for phone use and quick scheduling. Shown here as a concept example.",
  },
  {
    slug: "redline-electric",
    name: "Redline Electric",
    industry: "Electrical",
    services: "Website Design / Development",
    summary:
      "A direct site for a residential electrician — emergency calls, scheduled work, and a clear way to request a visit.",
    concept: true,
    accent: "#d4a000",
    preview: "electric",
    challenge:
      "Electricians get two kinds of visitors: someone with a dead panel tonight, and someone planning a charger or remodel. The site has to serve both without burying the phone number.",
    approach: [
      "Put emergency contact and hours on the first screen.",
      "Separate same-day repairs from planned work like panels and EV chargers.",
      "Keep the layout bold and easy to scan on a phone at night.",
    ],
    outcome:
      "A high-contrast electrician website built around calling and booking a visit. Shown here as a concept example.",
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
