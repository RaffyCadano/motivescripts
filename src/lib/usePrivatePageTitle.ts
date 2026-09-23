import { useEffect } from "react";

/**
 * Sets the browser tab title for signed-in app pages (admin/team/client).
 *
 * These pages are deliberately excluded from the public title map in seoPages.ts --
 * they're private and marked noindex, so postbuild-seo.mjs doesn't generate a real
 * static file for them and GitHub Pages serves 404.html for any direct load or
 * refresh instead. That's correct for crawlers, but 404.html's own <title> is
 * "Page not found — MotiveScripts": the SPA then boots and renders the real page
 * fine, but nothing ever corrected the tab title it started with. This hook is
 * that correction -- called once per section layout (Admin/Team/Client), not per
 * page, so every route in that section is covered without touching each page file.
 */
export function usePrivatePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
