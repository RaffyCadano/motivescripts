import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrowserFrame } from "@/components/BrowserFrame";
import { cn } from "@/lib/cn";
import houseHero from "@/assets/previews/landscape-stone.webp";

// The width each mock page is laid out at before being scaled down to fit its frame.
const DESKTOP_W = 1280;
const TABLET_W = 820;
const PHONE_W = 390;

// One fictional business, three layouts of it. The copy is shared so the devices read as the same site.
const STATS = [
  ["4.9★", "120+ reviews"],
  ["15+", "years in business"],
  ["48 hr", "average response"],
  ["100%", "satisfaction guarantee"],
] as const;

const SERVICES = [
  ["Kitchen remodels", "Layout, cabinets, and finish work start to finish."],
  ["Bathroom renovations", "Full gut renovations or a quicker refresh."],
  ["Repairs & punch lists", "The list you keep putting off, handled in one visit."],
] as const;

const REVIEW_QUOTE = "“Showed up on time, quoted a fair price, and the kitchen looks better than we imagined.”";
const REVIEW_BY = "Dana R. · South Austin";

/** The same site on a desktop, a tablet, and a phone -- the point of a responsive website, shown rather than told. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[36rem] lg:max-w-none">
      <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-56 rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.06),transparent_64%)] blur-2xl" />

      <div className="relative z-10 px-3 pb-10 pt-2 sm:px-7 sm:pb-14 sm:pt-8 md:px-10 md:pb-16 md:pt-14">
        <BrowserFrame url="yoursite.com" className="shadow-[var(--shadow-card),var(--shadow-glow)]">
          <ScrollingMock pageWidth={DESKTOP_W}>
            <HeroSiteMock />
          </ScrollingMock>
        </BrowserFrame>

        <TabletFrame className="absolute bottom-0 left-0 w-[34%] sm:left-2 sm:w-[32%] md:left-4" />
        <PhoneFrame className="absolute bottom-1 right-0 w-[17%] sm:right-2 sm:w-[15%] md:right-4" />

        <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-[var(--radius-lg)] border border-[#d9dfe8] bg-[var(--ms-white)] px-3 py-2 shadow-[var(--shadow-card)] sm:flex sm:items-center sm:gap-2">
          <BrandMark className="h-7 w-auto" decorative />
          <p className="whitespace-nowrap font-heading text-xs font-semibold text-ink">Built by MotiveScripts</p>
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "aspect-[9/19] rounded-[1.15rem] bg-[#0b1b3a] shadow-[0_18px_40px_rgb(0_16_48_/_0.28)]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-[3px] overflow-hidden rounded-[0.95rem] bg-white">
        <ScrollingMock pageWidth={PHONE_W} delaySeconds={9}>
          <PhoneSiteMock />
        </ScrollingMock>
        <span className="absolute left-1/2 top-[3px] z-20 h-[3px] w-[28%] -translate-x-1/2 rounded-full bg-[#0b1b3a]" />
      </div>
    </div>
  );
}

function TabletFrame({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "aspect-[3/4] rounded-[1.1rem] bg-[#0b1b3a] shadow-[0_18px_40px_rgb(0_16_48_/_0.28)]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-1 overflow-hidden rounded-[0.8rem] bg-white">
        <ScrollingMock pageWidth={TABLET_W} delaySeconds={5}>
          <TabletSiteMock />
        </ScrollingMock>
      </div>
    </div>
  );
}

/**
 * Plays a mock site like it's being scrolled: measures how much taller the page is than the visible
 * window, then loops a translateY across that distance and back (CSS animation, so it costs nothing in
 * JS after setup). The page is laid out at `pageWidth` and scaled down to the frame, so each device can
 * show its own responsive layout. `delaySeconds` offsets the loop so the devices don't scroll in
 * lockstep. Same width-fit-then-scale trick as MiniPage, but MiniPage always stretches its content to
 * exactly fill the frame -- this one needs the content to stay its natural (taller) height so there's
 * somewhere to "scroll" to, so it isn't reused here.
 */
function ScrollingMock({
  pageWidth,
  delaySeconds = 0,
  children,
}: {
  pageWidth: number;
  delaySeconds?: number;
  children: ReactNode;
}) {
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
      const nextScale = width / pageWidth;
      setScale(nextScale);
      const unscaledViewportHeight = height / nextScale;
      setScrollDistance(Math.max(0, content.scrollHeight - unscaledViewportHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [pageWidth]);

  return (
    <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
      <div className="origin-top-left" style={{ width: pageWidth, transform: `scale(${scale})` }}>
        <div
          ref={contentRef}
          className="hero-scroll-track"
          style={
            {
              "--hero-scroll-distance": `${scrollDistance}px`,
              animationDelay: delaySeconds ? `-${delaySeconds}s` : undefined,
            } as CSSProperties
          }
        >
          {children}
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

function LogoMark() {
  return (
    <span className="grid size-9 place-items-center rounded-md bg-[#0050F0] font-heading text-sm font-extrabold text-white">
      F
    </span>
  );
}

/** The estimate form's contents; each layout wraps it in its own card. */
function EstimateForm() {
  return (
    <>
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
    </>
  );
}

function HeroImage({ overlay }: { overlay: string }) {
  return (
    <>
      <img src={houseHero} alt="" draggable={false} className="absolute inset-0 size-full max-w-none object-cover" />
      <div className={cn("absolute inset-0", overlay)} />
    </>
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
          <LogoMark />
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
        <HeroImage overlay="bg-[linear-gradient(100deg,rgba(11,27,58,0.90)_0%,rgba(11,27,58,0.62)_36%,rgba(11,27,58,0.08)_62%)]" />

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
          <EstimateForm />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-t border-[#e8edf4] px-10 py-5">
        {STATS.map(([big, note]) => (
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
          {SERVICES.map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#e8edf4] bg-[#f7f9fc] px-5 py-5">
              <p className="text-[15px] font-semibold">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5c6678]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e8edf4] bg-[#f7f9fc] px-10 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">Reviews</p>
        <p className="mt-1.5 max-w-lg font-heading text-xl font-extrabold leading-snug tracking-tight">{REVIEW_QUOTE}</p>
        <p className="mt-3 text-[13px] font-semibold text-[#5c6678]">{REVIEW_BY}</p>
      </div>

      <div className="flex items-center justify-between border-t border-[#e8edf4] px-10 py-6 text-[13px] text-[#5c6678]">
        <span className="font-heading font-semibold text-[#101828]">Fieldstone Co.</span>
        <span>Licensed &amp; insured · Serving Austin and nearby</span>
      </div>
    </div>
  );
}

/** Tablet layout: the nav stays, but the hero and grids tighten up. */
function TabletSiteMock() {
  return (
    <div className="bg-white text-[#101828]" aria-hidden="true">
      <div className="flex items-center justify-between bg-[#0b1b3a] px-8 py-2.5 text-[12px] text-white/80">
        <span>★★★★★ 4.9 (120 reviews) · Austin and nearby</span>
        <span className="font-heading font-semibold text-white">(512) 555-0160</span>
      </div>

      <div className="flex items-center justify-between border-b border-[#e8edf4] px-8 py-4">
        <div className="flex items-center gap-3">
          <LogoMark />
          <span className="font-heading text-lg font-extrabold tracking-tight">Fieldstone Co.</span>
        </div>
        <div className="flex items-center gap-5 text-[13px] font-semibold text-[#5c6678]">
          <span>Services</span>
          <span>Projects</span>
          <span>Reviews</span>
          <span className="rounded-full bg-[#0050F0] px-3.5 py-1.5 text-white">Get estimate</span>
        </div>
      </div>

      <div className="relative h-[29rem] overflow-hidden">
        <HeroImage overlay="bg-[linear-gradient(100deg,rgba(11,27,58,0.90)_0%,rgba(11,27,58,0.66)_44%,rgba(11,27,58,0.12)_78%)]" />

        <div className="relative z-10 px-8 pt-14">
          <div className="max-w-[23rem]">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-[#8fbcff]">
              Residential contracting
            </p>
            <p className="mt-3 max-w-[12ch] font-heading text-[2.9rem] font-extrabold leading-[1.04] text-white">
              Built for the way you work.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/80">
              Kitchens, baths, and repairs — with a clear estimate and a crew that shows up.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <TrustBadge>Licensed &amp; Insured</TrustBadge>
              <TrustBadge>15+ years</TrustBadge>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 right-8 z-10 w-[17rem] rounded-2xl bg-white p-5 shadow-[0_20px_45px_rgb(11_27_58_/_0.3)]">
          <EstimateForm />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-t border-[#e8edf4] px-8 py-5">
        {STATS.map(([big, note]) => (
          <div key={note}>
            <p className="font-heading text-xl font-extrabold text-[#0050F0]">{big}</p>
            <p className="mt-0.5 text-[12px] text-[#5c6678]">{note}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e8edf4] px-8 py-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">What we do</p>
        <p className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight">Popular services</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {SERVICES.map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#e8edf4] bg-[#f7f9fc] px-4 py-4">
              <p className="text-[14px] font-semibold">{title}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#5c6678]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e8edf4] bg-[#f7f9fc] px-8 py-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">Reviews</p>
        <p className="mt-1.5 max-w-md font-heading text-xl font-extrabold leading-snug tracking-tight">{REVIEW_QUOTE}</p>
        <p className="mt-3 text-[13px] font-semibold text-[#5c6678]">{REVIEW_BY}</p>
      </div>

      <div className="flex items-center justify-between border-t border-[#e8edf4] px-8 py-6 text-[12px] text-[#5c6678]">
        <span className="font-heading font-semibold text-[#101828]">Fieldstone Co.</span>
        <span>Licensed &amp; insured · Serving Austin and nearby</span>
      </div>
    </div>
  );
}

/** Phone layout: a menu button instead of a nav, a stacked hero with full-width actions, single-column grids. */
function PhoneSiteMock() {
  return (
    <div className="bg-white text-[#101828]" aria-hidden="true">
      <div className="bg-[#0b1b3a] px-4 py-2 text-center text-[11px] text-white/80">
        ★★★★★ 4.9 (120 reviews) · Austin and nearby
      </div>

      <div className="flex items-center justify-between border-b border-[#e8edf4] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-heading text-base font-extrabold tracking-tight">Fieldstone Co.</span>
        </div>
        <span className="flex size-9 flex-col items-center justify-center gap-[5px] rounded-lg border border-[#e8edf4]">
          <span className="h-0.5 w-4 rounded-full bg-[#101828]" />
          <span className="h-0.5 w-4 rounded-full bg-[#101828]" />
          <span className="h-0.5 w-4 rounded-full bg-[#101828]" />
        </span>
      </div>

      <div className="relative h-[34rem] overflow-hidden">
        <HeroImage overlay="bg-[linear-gradient(180deg,rgba(11,27,58,0.30)_0%,rgba(11,27,58,0.88)_62%)]" />

        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-7">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-[#8fbcff]">
            Residential contracting
          </p>
          <p className="mt-2.5 font-heading text-[2.4rem] font-extrabold leading-[1.05] text-white">
            Built for the way you work.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-white/80">
            Kitchens, baths, and repairs — with a clear estimate and a crew that shows up.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TrustBadge>Licensed &amp; Insured</TrustBadge>
            <TrustBadge>15+ years</TrustBadge>
          </div>
          <span className="mt-5 flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0050F0,#00A0FF)] py-3.5 text-[15px] font-semibold text-white">
            Get a free estimate
          </span>
          <span className="mt-2.5 flex items-center justify-center rounded-xl bg-white/15 py-3.5 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/30">
            Call (512) 555-0160
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-[#e8edf4] px-5 py-6">
        {STATS.map(([big, note]) => (
          <div key={note}>
            <p className="font-heading text-xl font-extrabold text-[#0050F0]">{big}</p>
            <p className="mt-0.5 text-[13px] text-[#5c6678]">{note}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e8edf4] px-5 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">What we do</p>
        <p className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight">Popular services</p>
        <div className="mt-5 space-y-3">
          {SERVICES.map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#e8edf4] bg-[#f7f9fc] px-4 py-4">
              <p className="text-[15px] font-semibold">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5c6678]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e8edf4] bg-[#f7f9fc] px-5 py-8">
        <div className="rounded-2xl bg-white p-5 shadow-[0_10px_28px_rgb(11_27_58_/_0.12)]">
          <EstimateForm />
        </div>
      </div>

      <div className="border-t border-[#e8edf4] px-5 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0050F0]">Reviews</p>
        <p className="mt-1.5 font-heading text-xl font-extrabold leading-snug tracking-tight">{REVIEW_QUOTE}</p>
        <p className="mt-3 text-[13px] font-semibold text-[#5c6678]">{REVIEW_BY}</p>
      </div>

      <div className="border-t border-[#e8edf4] px-5 py-6 text-center text-[13px] text-[#5c6678]">
        <p className="font-heading font-semibold text-[#101828]">Fieldstone Co.</p>
        <p className="mt-1">Licensed &amp; insured · Serving Austin and nearby</p>
      </div>
    </div>
  );
}
