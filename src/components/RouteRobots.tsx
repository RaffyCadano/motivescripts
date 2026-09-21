import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isPrivatePath } from "@/data/seoPages";

/**
 * Marks the signed-in areas (admin, client, team, sign-in and invitation pages) as not for search engines. The
 * built HTML already says so for the pages it writes; this covers client-side navigation and deep links.
 */
export function RouteRobots() {
  const { pathname } = useLocation();
  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (isPrivatePath(pathname)) {
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = "robots";
        tag.dataset.managed = "true";
        document.head.appendChild(tag);
      }
      tag.content = "noindex, nofollow";
    } else if (tag?.dataset.managed) {
      tag.remove();
    }
  }, [pathname]);
  return null;
}
