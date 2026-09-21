// Tests for the SEO build helpers and the shared page table.
//
//   node --test scripts/test-seo.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SITE_URL, isPrivatePath, seoPage, seoPages } from "../src/data/seoPages.ts";
import { allPages, buildRobots, buildSitemap, extractProjects, notFoundPage, outputFileFor, renderPageHtml } from "./seoBuild.mjs";

const template = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width" />
<meta
  name="description"
  content="old description"
/>
<meta property="og:title" content="old" /><meta property="og:url" content="https://raffycadano.github.io/motivescripts/" />
<title>Old title</title></head><body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body></html>`;

const projectsSource = readFileSync("src/data/projects.ts", "utf8");

test("the site URL matches the custom domain in public/CNAME", () => {
  assert.equal(SITE_URL, "https://" + readFileSync("public/CNAME", "utf8").trim());
});

test("every static page has a title, a description, and a path starting with /", () => {
  for (const page of seoPages) {
    assert.ok(page.title.length > 5 && page.description.length > 20, page.path);
    assert.ok(page.path.startsWith("/"), page.path);
  }
  assert.equal(new Set(seoPages.map((p) => p.path)).size, seoPages.length, "duplicate paths");
  assert.throws(() => seoPage("/nope"), /No SEO entry/);
});

test("every case study in projects.ts is found, with its real name and summary", () => {
  const projects = extractProjects(projectsSource);
  assert.equal(projects.length, (projectsSource.match(/slug:\s*"/g) ?? []).length);
  assert.ok(projects.length >= 11);
  const ridge = projects.find((p) => p.slug === "ridge-and-co");
  assert.equal(ridge.name, "Ridge & Co.");
  assert.match(ridge.summary, /landscaping/i);
  for (const p of projects) assert.ok(p.summary.length > 30, p.slug);
});

test("a page file has its own tags and none of the old ones, exactly once", () => {
  const html = renderPageHtml(template, { path: "/pricing", title: "Website Pricing — MotiveScripts", description: 'Say "hi" & <go>', indexable: true }, SITE_URL);
  assert.equal((html.match(/<title>/g) ?? []).length, 1);
  assert.match(html, /<title>Website Pricing — MotiveScripts<\/title>/);
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
  assert.match(html, /content="Say &quot;hi&quot; &amp; &lt;go&gt;"/); // escaped
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/motivescripts\.com\/pricing" \/>/);
  assert.match(html, /property="og:url" content="https:\/\/motivescripts\.com\/pricing"/);
  assert.match(html, /property="og:image" content="https:\/\/motivescripts\.com\/og-image\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.doesNotMatch(html, /old description|raffycadano|Old title/);
  assert.match(html, /<script type="module" src="\/assets\/index-abc\.js">/); // the app is untouched
  assert.doesNotMatch(html, /name="robots"/);
});

test("the home page canonical is the bare domain, and private pages are noindex with no canonical", () => {
  const home = renderPageHtml(template, seoPage("/"), SITE_URL);
  assert.match(home, /rel="canonical" href="https:\/\/motivescripts\.com\/"/);
  const login = renderPageHtml(template, seoPage("/login"), SITE_URL);
  assert.match(login, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(login, /rel="canonical"/);
  const notFound = renderPageHtml(template, notFoundPage(), SITE_URL);
  assert.match(notFound, /name="robots" content="noindex, nofollow"/);
  assert.match(notFound, /Page not found/);
});

test("output files: / is index.html, others are <path>.html so they serve at exactly that URL", () => {
  assert.equal(outputFileFor("/"), "index.html");
  assert.equal(outputFileFor("/pricing"), "pricing.html");
  assert.equal(outputFileFor("/work/live-oak-tree-co"), "work/live-oak-tree-co.html");
});

test("the sitemap lists every public page and case study on the real domain, and nothing private", () => {
  const pages = allPages(seoPages, extractProjects(projectsSource));
  const xml = buildSitemap(pages, SITE_URL, "2026-09-21");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes("https://motivescripts.com/"));
  assert.ok(locs.includes("https://motivescripts.com/pricing"));
  assert.ok(locs.includes("https://motivescripts.com/work/unlisted-wrap-garage"), "the case study the old sitemap missed");
  assert.ok(!locs.some((l) => l.includes("github.io")), "no old domain");
  assert.ok(!locs.some((l) => l.includes("/login")), "login is not indexable");
  assert.equal(locs.length, pages.filter((p) => p.indexable).length);
  assert.ok(xml.includes("<lastmod>2026-09-21</lastmod>"));
});

test("robots.txt points at the real sitemap and keeps crawlers out of the signed-in areas", () => {
  const robots = buildRobots(SITE_URL, ["/admin", "/client", "/team"]);
  assert.match(robots, /Sitemap: https:\/\/motivescripts\.com\/sitemap\.xml/);
  for (const p of ["/admin", "/client", "/team"]) assert.ok(robots.includes(`Disallow: ${p}\n`));
  assert.doesNotMatch(robots, /github\.io/);
});

test("private path detection covers the signed-in areas but not public pages", () => {
  for (const p of ["/admin", "/admin/clients/1", "/client", "/client/files", "/team/tasks", "/login", "/auth/callback", "/invite/abc", "/staff-invite/x"]) {
    assert.equal(isPrivatePath(p), true, p);
  }
  for (const p of ["/", "/pricing", "/work", "/work/ridge-and-co", "/start-a-project", "/administrator-guide", "/clients"]) {
    assert.equal(isPrivatePath(p), false, p);
  }
});
