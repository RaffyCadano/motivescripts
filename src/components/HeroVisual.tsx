import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrowserFrame } from "@/components/BrowserFrame";
import houseHero from "@/assets/previews/landscape-stone.webp";

const PAGE_W = 1280;

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[36rem] lg:max-w-none">
      <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-56 rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.06),transparent_64%)] blur-2xl" />

      <div className="relative z-10 px-3 pt-2 sm:px-7 sm:pt-8 md:px-10 md:pt-14">
        <BrowserFrame url="yoursite.com" className="shadow-[var(--shadow-card),var(--shadow-glow)]">
          <ScrollingSiteMock />
        </BrowserFrame>
        <div className="absolute -bottom-5 right-4 hidden rounded-[var(--radius-lg)] border border-[#d9dfe8] bg-[var(--ms-white)] px-3 py-2 shadow-[var(--shadow-card)] sm:flex sm:items-center sm:gap-2">
          <BrandMark className="h-7 w-auto" decorative />
          <p className="font-heading text-xs font-semibold text-ink">Built by MotiveScripts</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Plays the mock site like it's being scrolled: measures how much taller the page is than the
 * visible browser window, then loops a translateY across that distance and back (CSS animation,
 * so it costs nothing in JS after setup). Same width-fit-then-scale trick as MiniPage, but MiniPage
 * always stretches its content to exactly fill the frame -- this one needs the content to stay its
 * natural (taller) height so there's somewhere to "scroll" to, so it isn't reused here.
 */
function ScrollingSiteMock() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scrollDistance, setScrollDistance] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      const nextScale = width / PAGE_W;
      setScale(nextScale);
      const unscaledViewportHeight = height / nextScale;
      setScrollDistance(Math.max(0, content.scrollHeight - unscaledViewportHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
      <div className="origin-top-left" style={{ width: PAGE_W, transform: `scale(${scale})` }}>
        <div
          ref={contentRef}
          className="hero-scroll-track"
          style={{ "--hero-scroll-distance": `${scrollDistance}px` } as CSSProperties}
        >
          <HeroSiteMock />
        </div>
      </div>
    </div>
  );
}

function TrustBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-inset ring-white/25">
      {children}
    </span>
  );
}

function HeroSiteMock() {
  return (
    <div className="bg-white text-[#101828]" aria-hidden="true">
      <div className="flex items-center justify-between bg-[#0b1b3a] px-10 py-2.5 text-[13px] text-white/80">
        <span>★★★★★ 4.9 (120 reviews) · Austin and nearby</span>
        <span className="font-heading font-semibold text-white">(512) 555-0160</span>
      </div>

      <div className="flex items-center justify-between border-b border-[#e8edf4] px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-[#0050F0] font-heading text-sm font-extrabold text-white">
            F
          </span>
          <span className="font-heading text-lg font-extrabold tracking-tight">Fieldstone Co.</span>
        </div>
        <div className="flex items-center gap-7 text-sm font-semibold text-[#5c6678]">
          <span>Services</span>
          <span>Projects</span>
          <span>Reviews</span>
          <span className="rounded-full bg-[#0050F0] px-4 py-2 text-white">Get estimate</span>
        </div>
      </div>

      <div className="relative h-[27rem] overflow-hidden">
        <img
          src={houseHero}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full max-w-none object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(11,27,58,0.90)_0%,rgba(11,27,58,0.62)_36%,rgba(11,27,58,0.08)_62%)]" />

        <div className="relative z-10 flex h-full items-center px-10">
          <div className="max-w-lg">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-[#8fbcff]">
              Residential contracting
            </p>
            <p className="mt-3 max-w-[13ch] font-heading text-[3.1rem] font-extrabold leading-[1.04] text-white">
              Built for the way you work.
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
              Kitchens, baths, and repairs — with a clear estimate and a crew that shows up.
            </p>
            <div className="mt-6 flex items-center gap-2.5">
              <TrustBadge>Licensed &amp; Insured</TrustBadge>
              <TrustBadge>15+ years</TrustBadge>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 right-10 z-10 w-[19rem] rounded-2xl bg-white p-5 shadow-[0_20px_45px_rgb(11_27_58_/_0.3)]">
          <p className="font-heading text-[15px] font-extrabold">Get a free estimate</p>
          <p className="mt-1 text-[13px] text-[#5c6678]">Same-week visits, most projects.</p>
          <div className="mt-3.5 space-y-2">
            <div className="flex h-9 items-center rounded-lg border border-[#e8edf4] bg-[#f7f9fc] px-3 text-[13px] text-[#9aa4b2]">
              Full name
            </div>
            <div className="flex h-9 items-center rounded-lg border border-[#e8edf4] bg-[#f7f9fc] px-3 text-[13px] text-[#9aa4b2]">
              Phone number
            </div>
          </div>
          <span className="mt-3.5 flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0050F0,#00A0FF)] py-2.5 text-sm font-semibold text-white">
            Request estimate
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-t border-[#e8edf4] px-10 py-5">
        {[
          ["4.9★", "120+ reviews"],
          ["15+", "years in business"],
          ["48 hr", "average response"],
          ["100%", "satisfaction guarantee"],
        ].map(([big, note]) => (
          <div key={note}>
            <p className="font-heading text-xl font-extrabold text-[#0050F0]">{big}</p>
            <p className="mt-0.5 text-[13px] text-[#5c6678]">{note}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e8edf4] px-10 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">What we do</p>
        <p className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight">Popular services</p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            ["Kitchen remodels", "Layout, cabinets, and finish work start to finish."],
            ["Bathroom renovations", "Full gut renovations or a quicker refresh."],
            ["Repairs & punch lists", "The list you keep putting off, handled in one visit."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#e8edf4] bg-[#f7f9fc] px-5 py-5">
              <p className="text-[15px] font-semibold">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5c6678]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e8edf4] bg-[#f7f9fc] px-10 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">Reviews</p>
        <p className="mt-1.5 max-w-lg font-heading text-xl font-extrabold leading-snug tracking-tight">
          “Showed up on time, quoted a fair price, and the kitchen looks better than we imagined.”
        </p>
        <p className="mt-3 text-[13px] font-semibold text-[#5c6678]">Dana R. · South Austin</p>
      </div>

      <div className="flex items-center justify-between border-t border-[#e8edf4] px-10 py-6 text-[13px] text-[#5c6678]">
        <span className="font-heading font-semibold text-[#101828]">Fieldstone Co.</span>
        <span>Licensed &amp; insured · Serving Austin and nearby</span>
      </div>
    </div>
  );
}
