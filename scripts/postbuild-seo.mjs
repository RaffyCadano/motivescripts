// Runs after `vite build`. Writes, into dist/:
//   - a real HTML file for every public URL (dist/pricing/index.html, ...) with that page's own title,
//     description, canonical URL and social-preview tags, so each URL answers HTTP 200 with correct tags and
//     crawlers/link previews do not need to run JavaScript;
//   - 404.html for every other URL (unknown paths and signed-in app deep links): the same app, marked noindex;
//   - sitemap.xml and robots.txt for the real domain.
// Run automatically by `npm run build`.
import fs from "node:fs";
import path from "node:path";
import { SITE_URL, privatePathPrefixes, seoPages } from "../src/data/seoPages.ts";
import { allPages, buildRobots, buildSitemap, extractProjects, notFoundPage, outputFileFor, renderPageHtml } from "./seoBuild.mjs";

const dist = "dist";
const templatePath = path.join(dist, "index.html");
if (!fs.existsSync(templatePath)) throw new Error("dist/index.html not found; run vite build first.");
const template = fs.readFileSync(templatePath, "utf8");

const projects = extractProjects(fs.readFileSync("src/data/projects.ts", "utf8"));
const pages = allPages(seoPages, projects);

for (const page of pages) {
  const file = path.join(dist, outputFileFor(page.path));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderPageHtml(template, page, SITE_URL));
}
fs.writeFileSync(path.join(dist, "404.html"), renderPageHtml(template, notFoundPage(), SITE_URL));

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(dist, "sitemap.xml"), buildSitemap(pages, SITE_URL, today));
fs.writeFileSync(path.join(dist, "robots.txt"), buildRobots(SITE_URL, privatePathPrefixes));

console.log(`SEO: wrote ${pages.length} page files, 404.html, sitemap.xml (${pages.filter((p) => p.indexable).length} URLs) and robots.txt`);
