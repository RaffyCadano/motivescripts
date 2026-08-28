import { BrandMark } from "@/components/BrandMark";
import { BrowserFrame } from "@/components/BrowserFrame";
import { MiniPage } from "@/components/MiniPage";
import houseHero from "@/assets/previews/landscape-stone.jpg";

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[36rem] lg:max-w-none">
      <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-[18rem] rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.08),transparent_64%)] blur-2xl" />
      <div className="pointer-events-none absolute -left-10 bottom-4 size-44 rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.05),transparent_70%)] blur-2xl" />

      <div className="hero-grid pointer-events-none absolute inset-[-12%] opacity-80" />

      <div className="geo-drift pointer-events-none absolute bottom-16 left-[2%] z-[1] h-px w-24 bg-[linear-gradient(90deg,transparent,#00C8FF)] md:w-32" />

      <div className="relative z-10 px-7 pt-12 md:px-10 md:pt-14">
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

function HeroSiteMock() {
  return (
    <div className="flex h-full flex-col bg-white text-[#101828]" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between bg-[#0b1b3a] px-10 py-2.5 text-[13px] text-white/80">
        <span>Residential contracting · Austin and nearby</span>
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

      <div className="grid min-h-0 flex-1 grid-cols-2 items-center gap-10 px-10 py-8">
        <div className="min-w-0">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-[#0050F0]">
            Residential contracting
          </p>
          <p className="mt-3 max-w-[13ch] font-heading text-[3.1rem] font-extrabold leading-[1.04]">
            Built for the way you work.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5c6678]">
            Kitchens, baths, and repairs — with a clear estimate and a crew that shows up.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <span className="inline-flex rounded-md bg-[linear-gradient(135deg,#0050F0,#00A0FF)] px-5 py-2.5 text-sm font-semibold text-white">
              Request an estimate
            </span>
            <span className="text-sm text-[#5c6678]">Same-week visits</span>
          </div>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
          <img
            src={houseHero}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full max-w-none object-cover"
          />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-3 px-10 pb-8">
        {[
          ["Remodels", "Kitchens & baths"],
          ["Additions", "Rooms that fit"],
          ["Repairs", "Same-week visits"],
        ].map(([title, note]) => (
          <div key={title} className="rounded-xl border border-[#e8edf4] bg-[#f7f9fc] px-5 py-4">
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="mt-1 text-[13px] text-[#5c6678]">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
