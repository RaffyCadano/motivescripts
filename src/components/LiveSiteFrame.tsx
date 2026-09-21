import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Embeds a real, shipped client site. No allow-top-navigation, so the embedded page
 * can never navigate MotiveScripts away; popups (e.g. social links) open in a new tab.
 * The embedded site has to allow framing (no X-Frame-Options / frame-ancestors block);
 * if a client site ever starts blocking it, the poster image below stays visible.
 */
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

/** Width the embedded site is laid out at before being scaled down, so it shows its desktop layout at any size. */
const VIRTUAL_WIDTH = 1280;

/** Extra iframe width so the embedded page's own scrollbar sits outside the clipped frame. */
const SCROLLBAR_ALLOWANCE = 24;

type LiveSiteThumbnailProps = {
  url: string;
  title: string;
  /** Static screenshot shown until the live page has loaded (and kept if it never does). */
  poster?: string;
};

/**
 * A scaled-down, non-interactive live view that fills its (relatively positioned) parent,
 * used as the inline preview. Clicking is handled by whatever overlays it.
 */
export function LiveSiteThumbnail({ url, title, poster }: LiveSiteThumbnailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = size.width > 0 ? size.width / VIRTUAL_WIDTH : 0;

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-white">
      {poster ? (
        <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover object-top" />
      ) : null}
      {scale > 0 ? (
        <iframe
          src={url}
          title={`${title} live website preview`}
          loading="lazy"
          sandbox={SANDBOX}
          tabIndex={-1}
          onLoad={() => setLoaded(true)}
          className={cn(
            "pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
          style={{ width: VIRTUAL_WIDTH + SCROLLBAR_ALLOWANCE, height: size.height / scale, transform: `scale(${scale})` }}
        />
      ) : null}
    </div>
  );
}

/** Full-size, interactive embed for the lightbox. Fills its parent. */
export function LiveSiteEmbed({ url, title }: { url: string; title: string }) {
  return (
    <iframe
      src={url}
      title={`${title} live website`}
      sandbox={SANDBOX}
      className="size-full border-0 bg-white"
    />
  );
}
