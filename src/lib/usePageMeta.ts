import { useEffect } from "react";
import { appUrl } from "@/lib/appUrl";

function setMetaDescription(content: string) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Finds the single canonical link tag if one exists, otherwise creates it -- never duplicates. */
function setCanonicalLink(href: string) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

/**
 * Sets the tab title, meta description, and canonical URL for the current public page.
 * `canonicalPath` is an app-relative path (e.g. "/work" or "/work/some-slug") resolved
 * against the real deployed origin and base path via `appUrl`.
 */
export function usePageMeta(title: string, description: string, canonicalPath: string) {
  useEffect(() => {
    document.title = title;
    setMetaDescription(description);
    setCanonicalLink(appUrl(canonicalPath));
  }, [title, description, canonicalPath]);
}
