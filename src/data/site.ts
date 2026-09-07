export const site = {
  name: "MotiveScripts",
  tagline: "Digital experiences for growing businesses.",
  /** Public marketing and contact pages. */
  email: "contact-us@motivescripts.com",
  /** Shown on PDFs and in-app document headers. */
  supportEmail: "support@motivescripts.com",
  /** Supabase Auth magic-link sender. Set this in the Auth SMTP / sender settings. */
  authFromEmail: "no-reply@motivescripts.com",
  nav: [
    { label: "Work", href: "/work" },
    { label: "Services", href: "/services" },
    { label: "Process", href: "/process" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
  ],
} as const;

/** Local/service-business categories we design for. Reused by the homepage About teaser and the About page. */
export const clientTypes = [
  "Home service businesses",
  "Contractors",
  "Landscaping and tree services",
  "Cleaning companies",
  "Restaurants and salons",
  "Auto shops",
  "Professional services",
  "Other local businesses",
] as const;

export const pipeline = [
  {
    title: "Strategy",
    body: "We map the pages, the message, and the action we want visitors to take.",
  },
  {
    title: "Design",
    body: "Layouts that make the business clear on a phone and on a desktop.",
  },
  {
    title: "Development",
    body: "A fast, responsive site built from the approved design.",
  },
  {
    title: "Launch",
    body: "Testing, go-live, and a handoff you can actually use.",
  },
  {
    title: "Support",
    body: "Updates and care after the site is live, if you want them.",
  },
] as const;

export const whyPoints = [
  {
    title: "Business-Focused",
    body: "Every website is designed around your business, customers and goals.",
  },
  {
    title: "Clear Process",
    body: "You always know what stage your project is in and what comes next.",
  },
  {
    title: "Built to Grow",
    body: "The site is structured so it's easy to add pages, services, or features as your business grows.",
  },
  {
    title: "Long-Term Support",
    body: "Our relationship doesn't have to end when your website goes live.",
  },
] as const;
