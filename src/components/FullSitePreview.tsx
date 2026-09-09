import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const PAGE_W = 1280;

/**
 * Like MiniPage, but for a real scrollable preview instead of a cropped
 * thumbnail: scales 1280px-wide content down to fit the available width,
 * then reports its true scaled height to the DOM instead of forcing content
 * into a fixed box (MiniPage clips to the frame; this lets a taller page
 * scroll naturally inside whatever scroll container wraps it).
 */
export function FullSitePreview({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const nextScale = outer.clientWidth > 0 ? outer.clientWidth / PAGE_W : 1;
      setScale(nextScale);
      setHeight(inner.scrollHeight * nextScale);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="relative w-full" style={{ height: height || undefined }}>
      <div ref={innerRef} className="origin-top-left" style={{ width: PAGE_W, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
