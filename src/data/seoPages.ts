/**
 * The title and description of every public page, in one place. Each page reads its own entry (so the tab title
 * and meta tags match), and the post-build step (scripts/postbuild-seo.mjs) uses the same table to write a real
 * HTML file per URL, the sitemap, and robots.txt. That is what lets search engines and link previews see correct
 * tags without running JavaScript, and lets every page answer with HTTP 200 instead of the 404 GitHub Pages sends
 * for URLs it has no file for.
 *
 * Imports here are relative and use the .ts extension so Node can load this file directly in the build script.
 */
import { websiteStartingPrice } from "./pricing.ts";

export const SITE_URL = "https://motivescripts.com";

export type SeoPage = {
  /** App path, starting with "/". */
  path: string;
  title: string;
  description: string;
  /** false keeps the page out of the sitemap and tells search engines not to index it. */
  indexable: boolean;
};

export const seoPages: SeoPage[] = [
  {
    path: "/",
    title: "MotiveScripts — Websites that turn visitors into customers",
    description:
      "MotiveScripts designs and builds fast, modern websites for small businesses that want more calls, bookings, and customers.",
    indexable: true,
  },
  {
    path: "/work",
    title: "Work — MotiveScripts",
    description:
      "Selected client work and website concepts, showing how MotiveScripts structures websites for local service companies.",
    indexable: true,
  },
  {
    path: "/services",
    title: "Services — MotiveScripts",
    description:
      "Design, development, and support for small-business websites — from the first conversation through launch, with optional care afterward.",
    indexable: true,
  },
  {
    path: "/process",
    title: "Process — MotiveScripts",
    description: "A clear, six-step process from discovery to launch, with review built in before your site goes live.",
    indexable: true,
  },
  {
    path: "/pricing",
    title: "Website Pricing — MotiveScripts",
    description: `Websites start at ${websiteStartingPrice}. Every project is scoped individually, and your final quote reflects your goals, content, and functionality.`,
    indexable: true,
  },
  {
    path: "/about",
    title: "About — MotiveScripts",
    description:
      "MotiveScripts designs and develops websites for local and service businesses, from strategy through launch and ongoing care.",
    indexable: true,
  },
  {
    path: "/start-a-project",
    title: "Start a Project — MotiveScripts",
    description:
      "Tell us about the website you want to build. Share a few details about your business and project and we'll follow up with next steps.",
    indexable: true,
  },
  {
    path: "/login",
    title: "Sign in — MotiveScripts",
    description: "Sign in to your MotiveScripts project space.",
    indexable: false,
  },
  {
    path: "/privacy",
    title: "Privacy Policy — MotiveScripts",
    description:
      "What MotiveScripts collects through our website, client portal, and services, how it's used, and who we share it with.",
    indexable: true,
  },
  {
    path: "/terms",
    title: "Terms of Service — MotiveScripts",
    description: "The terms that cover using MotiveScripts's website, client portal, and services.",
    indexable: true,
  },
];

/** Looks up a page's entry. Throws for an unknown path so a typo fails loudly instead of shipping empty tags. */
export function seoPage(path: string): SeoPage {
  const page = seoPages.find((item) => item.path === path);
  if (!page) throw new Error(`No SEO entry for ${path}`);
  return page;
}

/** Path prefixes for the signed-in areas. They are never indexed. */
export const privatePathPrefixes = ["/admin", "/client", "/team", "/auth", "/invite", "/staff-invite", "/login"] as const;

export function isPrivatePath(pathname: string): boolean {
  return privatePathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}
