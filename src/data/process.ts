export const processSteps = [
  {
    number: "01",
    title: "Discover",
    body: "We learn about your business, audience and goals.",
    detail:
      "We start with how the business works today: who you serve, what you offer, and what a successful website needs to do. If you already have a site, we look at what is getting in the way. The goal is a clear brief, not a pile of assumptions.",
    includes: ["Business, audience, and goals", "Current site and competitors", "Project scope and timeline"],
  },
  {
    number: "02",
    title: "Strategy",
    body: "We define the structure, content and direction of the website.",
    detail:
      "Before design starts, we decide what the website needs to say and where it should send people. That includes the sitemap, the job of each page, and the primary action — call, book, or request a quote.",
    includes: ["Sitemap and page list", "Content direction", "Primary conversion path"],
  },
  {
    number: "03",
    title: "Design",
    body: "We create the visual experience around your brand.",
    detail:
      "We design the site around your brand and the way customers actually use it. Pages are built so services are easy to scan, trust is established quickly, and the next step is obvious on a phone.",
    includes: ["Homepage and key templates", "Mobile-first layouts", "Visual system and components"],
  },
  {
    number: "04",
    title: "Develop",
    body: "We turn the approved design into a fast, responsive website.",
    detail:
      "The approved design is built as a fast, maintainable website. We implement the pages, forms, and structure so the site works on modern devices and is ready for real customer use.",
    includes: ["Responsive front-end build", "Forms and contact paths", "Performance and accessibility basics"],
  },
  {
    number: "05",
    title: "Review",
    body: "You review the website and provide feedback before launch.",
    detail:
      "You review a staging version of the site and tell us what needs to change. We collect feedback in one focused pass, make revisions, and confirm the site is ready before it goes live.",
    includes: ["Staging preview", "Structured feedback", "Revisions before launch"],
  },
  {
    number: "06",
    title: "Launch",
    body: "We test, optimize and take your website live.",
    detail:
      "We test key pages and actions, then publish the site. After launch you have a live website and a clear handoff — including what happens next if you want ongoing updates or care.",
    includes: ["QA and launch checks", "Go-live", "Handoff and next steps"],
  },
] as const;
