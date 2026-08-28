import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const PAGE_W = 1280;

type MiniPageProps = {
  children: ReactNode;
};

export function MiniPage({ children }: MiniPageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setBox({ width: el.clientWidth, height: el.clientHeight });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = box.width > 0 ? box.width / PAGE_W : 1;
  const pageHeight = box.width > 0 ? box.height / scale : 800;

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        className="origin-top-left"
        style={{
          width: PAGE_W,
          height: pageHeight,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
