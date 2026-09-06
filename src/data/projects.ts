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
  preview:
    | "trees"
    | "landscape"
    | "cleaning"
    | "auto"
    | "electric"
    | "home_services"
    | "contractor"
    | "restaurant"
    | "salon"
    | "professional_services";
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
  {
    slug: "anchor-point-home",
    name: "Anchor Point Home Services",
    industry: "Home Services",
    services: "Website Design / Development",
    summary:
      "A trust-first website for a handyman and home-repair company, built to make free estimates and same-week scheduling the obvious next step.",
    concept: true,
    accent: "#2b5f8a",
    preview: "home_services",
    challenge:
      "Homeowners hesitate to let a stranger into their house. The site has to earn trust — licensed, insured, background-checked — before it ever asks for a booking.",
    approach: [
      "Lead with trust signals instead of a generic hero photo.",
      "Keep 'get an estimate' visible on every screen, not just the homepage.",
      "Group repairs the way homeowners actually search for them.",
    ],
    outcome:
      "A trust-forward home-services site built to convert quickly on a phone. This is a concept project, not a client engagement.",
  },
  {
    slug: "fieldstone-construction",
    name: "Fieldstone Construction",
    industry: "General Contracting",
    services: "Website Design / Development",
    summary:
      "A portfolio-driven website for a remodeling contractor, built to prove capability through real project work before a client commits to a bid.",
    concept: true,
    accent: "#33404a",
    preview: "contractor",
    challenge:
      "A remodel is a five- or six-figure decision. Visitors need proof of real capability, not just a page that says 'we do kitchens.'",
    approach: [
      "Lead with numbers that build confidence: years in business, projects completed.",
      "Explain the fixed-price-contract process step by step, so there are no surprises.",
      "Make the free estimate the one clear next step on every page.",
    ],
    outcome:
      "A capability-first contractor site built around proof and process. Shown here as a concept example.",
  },
  {
    slug: "the-amber-fork",
    name: "The Amber Fork",
    industry: "Restaurant",
    services: "Website Design / Development",
    summary:
      "A seasonal-menu bistro website built to make reservations effortless and the current menu easy to browse before walking in.",
    concept: true,
    accent: "#7a2331",
    preview: "restaurant",
    challenge:
      "Diners decide in seconds whether to book. A menu that reads like a scanned PDF from three years ago costs a reservation before the food ever gets a chance.",
    approach: [
      "Keep the menu feeling current and easy to scan, not buried in a PDF download.",
      "Put 'reserve a table' above the fold on every page.",
      "Design quietly enough that the food does the talking once real photography is in.",
    ],
    outcome:
      "A reservation-first restaurant site built around a current, browsable menu. This is a concept project.",
  },
  {
    slug: "bloom-and-blade",
    name: "Bloom & Blade",
    industry: "Salon & Barber",
    services: "Website Design / Development",
    summary:
      "A booking-first website for a combined salon and barbershop, built around real published pricing instead of a phone-only 'call for pricing' intake.",
    concept: true,
    accent: "#b76e79",
    preview: "salon",
    challenge:
      "Clients want to know the price and pick a specific stylist or barber before they ever call. A site that hides both loses the booking to whoever answers first.",
    approach: [
      "Publish real pricing instead of 'call for pricing.'",
      "Put 'book now' in reach on every screen, for both walk-in and appointment clients.",
      "Give the team enough personality on the page to help clients choose who to book.",
    ],
    outcome:
      "A booking-first salon/barbershop site built around clear pricing and easy scheduling. Shown here as a concept example.",
  },
  {
    slug: "kestrel-advisory-group",
    name: "Kestrel Advisory Group",
    industry: "Professional Services",
    services: "Website Design / Development",
    summary:
      "A credibility-first website for a business advisory firm, built to earn trust through a specific, no-jargon offer before price ever comes up.",
    concept: true,
    accent: "#16324f",
    preview: "professional_services",
    challenge:
      "Prospective clients are vetting expertise, not comparing prices. A generic 'we do consulting' page reads as interchangeable with every other firm.",
    approach: [
      "Lead with specific outcomes clients get, not a generic service menu.",
      "Put advisor credentials front and center to build trust fast.",
      "Make 'schedule a consultation' the one unambiguous next step.",
    ],
    outcome:
      "A credibility-first advisory-firm site built around expertise and a clear next step. This is a concept project.",
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
