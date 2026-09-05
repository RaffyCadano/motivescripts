import { useEffect } from "react";

function setMetaDescription(content: string) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Sets the tab title and meta description for the current public page. */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    setMetaDescription(description);
  }, [title, description]);
}
