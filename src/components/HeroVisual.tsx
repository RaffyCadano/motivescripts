import { BrandMark } from "@/components/BrandMark";
import { BrowserFrame } from "@/components/BrowserFrame";
import { MiniPage } from "@/components/MiniPage";
import houseHero from "@/assets/previews/landscape-stone.jpg";

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[36rem] lg:max-w-none">
      <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-56 rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.06),transparent_64%)] blur-2xl" />

      <div className="relative z-10 px-3 pt-2 sm:px-7 sm:pt-8 md:px-10 md:pt-14">
        <BrowserFrame url="yoursite.com" className="shadow-[var(--shadow-card),var(--shadow-glow)]">
          <MiniPage>
            <HeroSiteMock />
          </MiniPage>
        </BrowserFrame>
        <div className="absolute -bottom-5 right-4 hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-card)] px-3 py-2 shadow-[var(--shadow-card)] sm:flex sm:items-center sm:gap-2">
          <BrandMark className="h-7 w-auto" decorative />
          <p className="font-heading text-xs font-semibold text-ink">Built by MotiveScripts</p>
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
    <div className="flex h-full flex-col bg-white text-[#101828]" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between bg-[#0b1b3a] px-10 py-2.5 text-[13px] text-white/80">
        <span>★★★★★ 4.9 (120 reviews) · Austin and nearby</span>
        <span className="font-heading font-semibold text-white">(512) 555-0160</span>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-[#e8edf4] px-10 py-4">
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
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

      <div className="grid shrink-0 grid-cols-4 gap-3 border-t border-[#e8edf4] px-10 py-5">
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
    </div>
  );
}
