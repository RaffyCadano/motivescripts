import { BrowserFrame } from "@/components/BrowserFrame";
import { MiniPage } from "@/components/MiniPage";
import type { Project } from "@/data/projects";
import { cn } from "@/lib/cn";
import treesHero from "@/assets/previews/trees-hero.jpg";
import landscapeHero from "@/assets/previews/landscape-hero.jpg";
import landscapeStone from "@/assets/previews/landscape-stone.jpg";
import landscapeCare from "@/assets/previews/landscape-care.jpg";
import cleaningHero from "@/assets/previews/cleaning-hero.jpg";
import autoHero from "@/assets/previews/auto-hero.jpg";
import electricHero from "@/assets/previews/electric-hero.jpg";

type SitePreviewProps = {
  project: Project;
};

export function SitePreview({ project }: SitePreviewProps) {
  return (
    <BrowserFrame url={`${project.slug.replace(/-/g, "")}.com`}>
      <MiniPage>
        {project.preview === "trees" ? <TreesPreview /> : null}
        {project.preview === "landscape" ? <LandscapePreview /> : null}
        {project.preview === "cleaning" ? <CleaningPreview /> : null}
        {project.preview === "auto" ? <AutoPreview /> : null}
        {project.preview === "electric" ? <ElectricPreview /> : null}
        {project.preview === "home_services" ? <HomeServicesPreview /> : null}
        {project.preview === "contractor" ? <ContractorPreview /> : null}
        {project.preview === "restaurant" ? <RestaurantPreview /> : null}
        {project.preview === "salon" ? <SalonPreview /> : null}
        {project.preview === "professional_services" ? <ProfessionalServicesPreview /> : null}
      </MiniPage>
    </BrowserFrame>
  );
}

function TreesPreview() {
  return (
    <div className="relative flex h-full flex-col text-white" aria-hidden="true">
      <Photo src={treesHero} className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(5_14_10_/_0.88)_0%,rgb(5_14_10_/_0.55)_34%,rgb(5_14_10_/_0.18)_58%,transparent_78%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_14_10_/_0.42)_0%,transparent_24%,transparent_62%,rgb(5_14_10_/_0.55)_100%)]" />

      <div className="relative z-10 flex items-center justify-between px-10 py-2.5 text-[13px] text-white/75">
        <span>Licensed & insured · Serving Austin</span>
        <span className="font-heading font-semibold text-white">(512) 555-0144</span>
      </div>

      <div className="relative z-10 flex items-center justify-between border-y border-white/10 bg-black/25 px-10 py-4 backdrop-blur-[2px]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-[#2f8a4a] font-heading text-sm font-extrabold">
            L
          </span>
          <span className="font-heading text-xl font-extrabold tracking-tight">Live Oak Tree Co.</span>
        </div>
        <div className="flex items-center gap-7 text-[13px] font-semibold text-white/85">
          <span>Services</span>
          <span>Storm work</span>
          <span>Service area</span>
          <span className="rounded-md bg-[#2f8a4a] px-4 py-2 text-white">Get a quote</span>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-10">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#b7dcb0]">
          Removal · Trimming · Stump
        </p>
        <p className="mt-3 max-w-[14ch] font-heading text-[3.4rem] font-extrabold leading-[1.02]">
          Tree care, done properly.
        </p>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/82">
          Residential and commercial crews. Clear estimates. Same-week availability after storms.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="rounded-md bg-[#2f8a4a] px-5 py-2.5 text-sm font-semibold shadow-[0_10px_24px_rgb(0_0_0_/_0.28)]">
            Request a quote
          </span>
          <span className="text-sm text-white/75">Call (512) 555-0144</span>
        </div>
      </div>

      <div className="relative z-10 grid shrink-0 grid-cols-3 gap-3 px-10 pb-8">
        {[
          ["Tree removal", "Hazard & takedown"],
          ["Crown thinning", "Health & clearance"],
          ["Storm cleanup", "Same-week crews"],
        ].map(([title, note]) => (
          <div
            key={title}
            className="rounded-lg bg-white/10 px-4 py-3.5 ring-1 ring-white/15 backdrop-blur-[3px]"
          >
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-[13px] text-white/70">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandscapePreview() {
  return (
    <div className="relative flex h-full flex-col text-[#f3efe4]" aria-hidden="true">
      <div className="absolute inset-0 grid grid-cols-3">
        {[
          { src: landscapeHero, position: "center 70%" },
          { src: landscapeStone, position: "center" },
          { src: landscapeCare, position: "center 40%" },
        ].map((panel) => (
          <div key={panel.src} className="relative min-h-0 border-r border-white/10 last:border-r-0">
            <Photo src={panel.src} className="absolute inset-0 size-full" position={panel.position} />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(36_48_34_/_0.58)_0%,transparent_26%,transparent_48%,rgb(36_48_34_/_0.86)_100%)]" />

      <div className="relative z-10 flex items-center justify-between px-10 py-6">
        <div>
          <p className="font-heading text-lg font-extrabold tracking-[0.22em]">RIDGE & CO.</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#c5cdb8]">
            Landscape studio
          </p>
        </div>
        <div className="flex items-center gap-7 text-[13px] font-semibold text-white/85">
          <span>Gardens</span>
          <span>Hardscape</span>
          <span>Care</span>
          <span className="rounded-full bg-[#f3efe4] px-4 py-2 text-[#243022]">Start a project</span>
        </div>
      </div>

      <div className="relative z-10 mt-auto px-10 pb-10">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#c5cdb8]">
          Austin · Gardens · Stone
        </p>
        <p className="mt-3 max-w-[16ch] font-heading text-[3.4rem] font-extrabold leading-[1.04]">
          Outdoor spaces that last.
        </p>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-md text-[15px] leading-relaxed text-white/80">
            Design, build, and maintain residential landscapes — from garden rooms to stonework.
          </p>
          <span className="rounded-md bg-[#f3efe4] px-5 py-2.5 text-sm font-semibold text-[#243022]">
            View the work
          </span>
        </div>
      </div>
    </div>
  );
}

function CleaningPreview() {
  return (
    <div className="flex h-full flex-col bg-white text-[#1c2430]" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between px-10 py-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#1d6fd1] font-heading text-sm font-extrabold text-white">
            M
          </span>
          <span className="font-heading text-lg font-extrabold tracking-tight">Marlow Cleaning Co.</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-semibold text-[#5b6573]">
          <span>(512) 555-0188</span>
          <span className="rounded-full bg-[#1d6fd1] px-4 py-2 text-white">Book now</span>
        </div>
      </div>

      <div className="shrink-0 px-10 pb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#1d6fd1]">
          <Stars />
          <span>4.9 from 200+ homes</span>
        </div>
        <p className="mx-auto mt-3 max-w-[18ch] font-heading text-[3rem] font-extrabold leading-[1.05]">
          Homes and offices, kept ready.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#5b6573]">
          Recurring residential and commercial cleaning with a simple weekly schedule.
        </p>
      </div>

      <div className="relative mx-10 min-h-0 flex-1 overflow-hidden rounded-2xl">
        <Photo src={cleaningHero} className="absolute inset-0 size-full" position="center 35%" />
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-4 px-10 py-6">
        {[
          ["Standard clean", "Weekly", "Most booked"],
          ["Deep clean", "Seasonal", "From $249"],
          ["Move-out", "One-time", "Keys ready"],
        ].map(([title, cadence, note]) => (
          <div key={title} className="rounded-xl border border-[#e6ebf2] bg-[#f7f9fc] px-5 py-4">
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="mt-1 text-sm text-[#1d6fd1]">{cadence}</p>
            <p className="mt-0.5 text-[13px] text-[#7b8494]">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutoPreview() {
  return (
    <div className="flex h-full flex-col bg-[#f6f3ed] text-[#1a1c1f]" aria-hidden="true">
      <div className="relative min-h-0 flex-[1.4]">
        <Photo src={autoHero} className="absolute inset-0 size-full" position="center 38%" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-8 py-5">
          <span className="rounded-md bg-white/94 px-3 py-1.5 font-heading text-sm font-extrabold tracking-tight shadow-[0_8px_20px_rgb(0_0_0_/_0.12)]">
            Northline Auto
          </span>
          <span className="rounded-md bg-[#c45c2a] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgb(0_0_0_/_0.16)]">
            Schedule
          </span>
        </div>
      </div>

      <div className="shrink-0 border-t-4 border-[#c45c2a] px-8 py-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c45c2a]">
          Diagnostics · Brakes · Tires
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-[13ch] font-heading text-[2.7rem] font-extrabold leading-[1.05]">
            Service you can schedule.
          </p>
          <p className="max-w-xs text-[15px] leading-relaxed text-[#5c564c]">
            Honest estimates, same-day diagnostics, and a shop that answers the phone.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {["Brakes", "Tires", "Oil", "A/C"].map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#e4dfd4] bg-white px-3.5 py-1.5 text-[13px] font-semibold"
            >
              {item}
            </span>
          ))}
          <span className="ml-auto text-[13px] text-[#7a7468]">Mon–Sat · North Austin</span>
        </div>
      </div>
    </div>
  );
}

function ElectricPreview() {
  return (
    <div className="relative flex h-full text-[#f4f1e8]" aria-hidden="true">
      <Photo src={electricHero} className="absolute inset-0 size-full" position="center 35%" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(17_17_17_/_0.94)_0%,rgb(17_17_17_/_0.7)_46%,rgb(17_17_17_/_0.18)_100%)]" />

      <div className="relative z-10 flex w-[8.5rem] shrink-0 flex-col items-center justify-between bg-[#f0c400] py-8 text-[#111111]">
        <p
          className="font-heading text-[11px] font-extrabold uppercase tracking-[0.22em]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Licensed · Austin
        </p>
        <div className="text-center">
          <p className="font-heading text-4xl font-extrabold leading-none">24</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em]">Hour</p>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between px-10 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-lg font-extrabold tracking-tight">Redline Electric</p>
            <p className="mt-0.5 text-[12px] text-white/70">(512) 555-0190</p>
          </div>
          <span className="rounded-md bg-[#f0c400] px-4 py-2 text-sm font-semibold text-[#111111]">
            Request a visit
          </span>
        </div>

        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#f0c400]">
            Panels · Lighting · EV
          </p>
          <p className="mt-3 max-w-[13ch] font-heading text-[3.2rem] font-extrabold leading-[1.02]">
            Power on. Same day.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/78">
            Emergency repairs tonight, or a scheduled panel and charger install — one shop, one number.
          </p>
        </div>

        <div className="grid max-w-xl grid-cols-2 gap-3">
          {[
            ["01", "Emergency call"],
            ["02", "Panel upgrade"],
            ["03", "EV charger"],
            ["04", "Whole-home lighting"],
          ].map(([num, label]) => (
            <div key={num} className="flex items-center gap-3 border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-[2px]">
              <span className="font-heading text-xs font-bold text-[#f0c400]">{num}</span>
              <span className="text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeServicesPreview() {
  return (
    <div className="flex h-full flex-col bg-[#f7fafc] text-[#132436]" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between px-10 py-2.5 text-[13px] text-[#4f6478]">
        <span>Licensed · Insured · Background-checked</span>
        <span className="font-heading font-semibold text-[#2b5f8a]">(512) 555-0171</span>
      </div>
      <div className="flex shrink-0 items-center justify-between border-y border-[#dbe6ee] bg-white px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-[#2b5f8a] font-heading text-sm font-extrabold text-white">
            A
          </span>
          <span className="font-heading text-xl font-extrabold tracking-tight">Anchor Point</span>
        </div>
        <span className="rounded-md bg-[#e07b39] px-4 py-2 text-sm font-semibold text-white">Get an estimate</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] items-center gap-10 px-10 py-8">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#2b5f8a]">
            Repairs · Installation · Maintenance
          </p>
          <p className="mt-3 max-w-[15ch] font-heading text-[3rem] font-extrabold leading-[1.05] text-[#132436]">
            One call for everything on your list.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#4f6478]">
            Upfront pricing, background-checked technicians, and same-week scheduling for the repairs
            homeowners keep putting off.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["✓", "Licensed & Insured"],
            ["✓", "Background-Checked"],
            ["✓", "Upfront Pricing"],
            ["✓", "Same-Week Slots"],
          ].map(([mark, label]) => (
            <div key={label} className="rounded-lg border border-[#dbe6ee] bg-white px-4 py-3.5 shadow-[0_8px_20px_rgb(19_36_54_/_0.06)]">
              <span className="grid size-7 place-items-center rounded-full bg-[#e6f0f7] font-heading text-sm font-bold text-[#2b5f8a]">
                {mark}
              </span>
              <p className="mt-2 text-[13px] font-semibold leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContractorPreview() {
  return (
    <div className="flex h-full flex-col bg-[#1c232a] text-white" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between px-10 py-6">
        <span className="font-heading text-lg font-extrabold tracking-tight">Fieldstone Construction</span>
        <span className="rounded-md bg-[#d9731c] px-4 py-2 text-sm font-semibold">Free Estimate</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center px-10">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#e39a56]">
          Remodels · Additions · Renovations
        </p>
        <p className="mt-3 max-w-[16ch] font-heading text-[3.1rem] font-extrabold leading-[1.05]">
          Built the way you'd want your own house done.
        </p>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-px border-t border-white/10 bg-white/10">
        {[
          ["18+", "Years in Business"],
          ["400+", "Projects Completed"],
          ["4.9★", "Average Rating"],
        ].map(([stat, label]) => (
          <div key={label} className="bg-[#1c232a] px-8 py-7 text-center">
            <p className="font-heading text-[2.4rem] font-extrabold text-[#e39a56]">{stat}</p>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RestaurantPreview() {
  return (
    <div className="flex h-full flex-col items-center bg-[#faf3ee] px-10 py-8 text-center text-[#3a1219]" aria-hidden="true">
      <div className="flex w-full shrink-0 items-center justify-between text-[13px] font-semibold text-[#7a2331]">
        <span>The Amber Fork</span>
        <span className="flex gap-6 uppercase tracking-[0.12em] text-[#a8636f]">
          <span>Menu</span>
          <span>About</span>
          <span>Reserve</span>
        </span>
      </div>
      <div className="mt-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">
          Seasonal American Bistro
        </p>
        <p className="mt-3 max-w-[20ch] font-heading text-[2.9rem] italic leading-[1.1]" style={{ fontFamily: "Georgia, serif" }}>
          Plates that change with the season.
        </p>
      </div>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 text-left">
        {[
          ["Roasted Beet Salad", "$14"],
          ["Pan-Seared Duck Breast", "$34"],
          ["Dark Chocolate Tart", "$11"],
        ].map(([dish, price]) => (
          <div key={dish} className="flex items-baseline justify-between border-b border-[#e6d3ca] py-2">
            <span className="font-heading text-[15px] font-semibold">{dish}</span>
            <span className="mx-3 flex-1 border-b border-dotted border-[#c9a8a0]" />
            <span className="font-heading text-[15px] font-bold text-[#7a2331]">{price}</span>
          </div>
        ))}
      </div>
      <span className="mt-7 rounded-md bg-[#7a2331] px-6 py-2.5 text-sm font-semibold text-white">Reserve a Table</span>
    </div>
  );
}

function SalonPreview() {
  return (
    <div className="flex h-full text-white" aria-hidden="true">
      <div className="flex min-h-0 flex-[1.4] flex-col justify-between bg-[#201b1c] px-10 py-8">
        <span className="font-heading text-lg font-extrabold tracking-tight">Bloom &amp; Blade</span>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#d99aa4]">
            Salon &amp; Barber
          </p>
          <p className="mt-3 max-w-[13ch] font-heading text-[2.9rem] font-extrabold leading-[1.05]">
            Cuts &amp; color, on your schedule.
          </p>
        </div>
        <span className="w-fit rounded-md bg-[#b76e79] px-5 py-2.5 text-sm font-semibold">Book Now</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 bg-[#2f2325] px-8 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d99aa4]">Popular Services</p>
        {[
          ["Women's Cut", "$65"],
          ["Men's Cut", "$40"],
          ["Full Color", "$95"],
          ["Beard Trim", "$20"],
        ].map(([service, price]) => (
          <div key={service} className="flex items-baseline justify-between border-b border-white/10 pb-2">
            <span className="text-[14px] font-semibold">{service}</span>
            <span className="font-heading text-[14px] font-bold text-[#e3aeb5]">{price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfessionalServicesPreview() {
  return (
    <div className="flex h-full text-white" aria-hidden="true">
      <div className="flex w-[15.5rem] shrink-0 flex-col justify-between border-r border-[#c9a24b]/30 bg-[#0f2338] px-6 py-8">
        <span className="font-heading text-base font-extrabold tracking-tight">Kestrel Advisory</span>
        <div className="space-y-5">
          {[
            ["20+", "Years Advising"],
            ["500+", "Clients Served"],
            ["Certified", "Financial Advisors"],
          ].map(([stat, label]) => (
            <div key={label}>
              <p className="font-heading text-xl font-extrabold text-[#c9a24b]">{stat}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center bg-[#16324f] px-10">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#c9a24b]">
          Business Advisory &amp; Consulting
        </p>
        <p className="mt-3 max-w-[16ch] font-heading text-[2.7rem] font-extrabold leading-[1.08]">
          Straight advice for the decisions that matter.
        </p>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
          Clear recommendations from advisors who take the time to understand your business first.
        </p>
        <span className="mt-6 w-fit rounded-md bg-[#c9a24b] px-5 py-2.5 text-sm font-semibold text-[#16324f]">
          Schedule a Consultation
        </span>
      </div>
    </div>
  );
}

function Photo({
  src,
  className,
  position = "center",
}: {
  src: string;
  className?: string;
  position?: string;
}) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn("max-w-none object-cover", className)}
      style={{ objectPosition: position }}
    />
  );
}

function Stars() {
  return (
    <span className="inline-flex gap-0.5 text-[#f5b301]" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 12 12" className="size-3.5 fill-current">
          <path d="M6 0.8 7.4 4.2 11.1 4.5 8.3 6.9 9.2 10.6 6 8.7 2.8 10.6 3.7 6.9 0.9 4.5 4.6 4.2Z" />
        </svg>
      ))}
    </span>
  );
}
