// Pure helpers for the post-build SEO step (scripts/postbuild-seo.mjs): write a real HTML file per public URL with
// correct tags, plus the sitemap and robots.txt. Kept free of file access so scripts/test-seo.mjs can test them.

export function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Reads slug, name and summary for each case study out of src/data/projects.ts (which imports images, so it cannot be loaded in Node). */
export function extractProjects(source) {
  const pattern = /slug:\s*"([^"]+)",\s*name:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?summary:\s*"((?:[^"\\]|\\.)*)"/g;
  const unescape = (text) => JSON.parse(`"${text}"`);
  const projects = [];
  for (const match of source.matchAll(pattern)) projects.push({ slug: match[1], name: unescape(match[2]), summary: unescape(match[3]) });
  const declared = (source.match(/slug:\s*"/g) ?? []).length;
  if (projects.length !== declared) {
    throw new Error(`Read ${projects.length} projects but found ${declared} slugs in projects.ts; the file format changed.`);
  }
  return projects;
}

/** Every page to write: the static ones plus one per case study. */
export function allPages(seoPages, projects) {
  const caseStudies = projects.map((project) => ({
    path: `/work/${project.slug}`,
    title: `${project.name} — MotiveScripts`,
    description: project.summary,
    indexable: true,
  }));
  return [...seoPages, ...caseStudies];
}

// Tags this step owns. They are removed from the built index.html and re-added per page, so nothing is duplicated.
const OWNED_TAGS = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="description"[\s\S]*?\/?>\s*/gi,
  /<meta\s+name="robots"[\s\S]*?\/?>\s*/gi,
  /<meta\s+property="og:[a-z:_]+"[\s\S]*?\/?>\s*/gi,
  /<meta\s+name="twitter:[a-z:_]+"[\s\S]*?\/?>\s*/gi,
  /<link\s+rel="canonical"[\s\S]*?\/?>\s*/gi,
];

export function renderPageHtml(template, page, siteUrl, { image = "/og-image.png" } = {}) {
  let html = template;
  for (const pattern of OWNED_TAGS) html = html.replace(pattern, "");
  const url = page.path === "/" ? `${siteUrl}/` : `${siteUrl}${page.path}`;
  const imageUrl = `${siteUrl}${image}`;
  const lines = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    page.indexable ? `<link rel="canonical" href="${url}" />` : `<meta name="robots" content="noindex, nofollow" />`,
    `<meta property="og:site_name" content="MotiveScripts" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="MotiveScripts: websites that turn visitors into customers" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
  ];
  if (!html.includes("</head>")) throw new Error("index.html has no </head>");
  return html.replace("</head>", `    ${lines.join("\n    ")}\n  </head>`);
}

/** The page served for a URL that has no file (unknown paths and signed-in app deep links): never indexed. */
export function notFoundPage() {
  return {
    path: "/404",
    title: "Page not found — MotiveScripts",
    description: "This page could not be found.",
    indexable: false,
  };
}

export function buildSitemap(pages, siteUrl, today) {
  const urls = pages
    .filter((page) => page.indexable)
    .map((page) => `  <url>\n    <loc>${siteUrl}${page.path === "/" ? "/" : page.path}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(siteUrl, privatePrefixes) {
  const disallow = privatePrefixes.map((prefix) => `Disallow: ${prefix}`).join("\n");
  return `User-agent: *\nAllow: /\n${disallow}\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

/**
 * Where a page's file goes inside dist/. "/" is index.html; "/pricing" is pricing.html. GitHub Pages serves
 * pricing.html at exactly /pricing with a 200, whereas a pricing/index.html folder would redirect /pricing to
 * /pricing/ first.
 */
export function outputFileFor(pagePath) {
  return pagePath === "/" ? "index.html" : `${pagePath.replace(/^\//, "")}.html`;
}
