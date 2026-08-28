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
            K
          </span>
          <span className="font-heading text-xl font-extrabold tracking-tight">Koala Trees</span>
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
    <div className="flex h-full flex-col bg-[#f3efe4] text-[#243022]" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between px-10 py-5">
        <div>
          <p className="font-heading text-lg font-extrabold tracking-[0.22em]">RIDGE & CO.</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6d7a62]">
            Landscape studio
          </p>
        </div>
        <div className="flex items-center gap-7 text-[13px] font-semibold text-[#5d6a54]">
          <span>Gardens</span>
          <span>Hardscape</span>
          <span>Care</span>
          <span className="rounded-full bg-[#2d3b28] px-4 py-2 text-[#f3efe4]">Start a project</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col justify-center px-10 pr-8">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#6d7a62]">
            Austin · Gardens · Stone
          </p>
          <p className="mt-3 max-w-[12ch] font-heading text-[3.15rem] font-extrabold leading-[1.05]">
            Outdoor spaces that last.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#44513c]">
            Design, build, and maintain residential landscapes — from garden rooms to stonework.
          </p>
          <div className="mt-7 flex items-center gap-4">
            <span className="rounded-md bg-[#2d3b28] px-5 py-2.5 text-sm font-semibold text-[#f3efe4]">
              View the work
            </span>
            <span className="text-sm text-[#6d7a62]">Est. 2014</span>
          </div>
        </div>
        <div className="flex min-h-0 items-center pr-10">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
            <Photo src={landscapeCare} className="absolute inset-0 size-full" position="center" />
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-3 px-10 py-5">
        {[
          { src: landscapeHero, label: "Gardens", note: "Planting & rooms", position: "center 70%" },
          { src: landscapeStone, label: "Hardscape", note: "Patios & walls", position: "center" },
          { src: landscapeCare, label: "Ongoing care", note: "Seasonal visits", position: "center 40%" },
        ].map((item) => (
          <div key={item.label} className="overflow-hidden rounded-lg bg-white shadow-[0_1px_0_rgb(0_0_0_/_0.05)]">
            <div className="relative h-24">
              <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
            </div>
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-[12px] text-[#6d7a62]">{item.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CleaningPreview() {
  return (
    <div className="flex h-full flex-col bg-[#f7f9fc] text-[#1c2430]" aria-hidden="true">
      <div className="flex shrink-0 items-center justify-between bg-[#14324f] px-10 py-2.5 text-[13px] text-white/80">
        <span>Residential & commercial · Austin and nearby</span>
        <span className="font-heading font-semibold text-white">(512) 555-0188</span>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-[#e6ebf2] bg-white px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#1d6fd1] font-heading text-sm font-extrabold text-white">
            M
          </span>
          <span className="font-heading text-lg font-extrabold tracking-tight">Marlow Cleaning Co.</span>
        </div>
        <div className="flex items-center gap-7 text-sm font-semibold text-[#5b6573]">
          <span>Residential</span>
          <span>Commercial</span>
          <span>Pricing</span>
          <span className="rounded-full bg-[#1d6fd1] px-4 py-2 text-white">Book now</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 items-stretch gap-10 px-10 py-8">
        <div className="flex min-w-0 flex-col justify-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1d6fd1]">
            <Stars />
            <span>4.9 from 200+ homes</span>
          </div>
          <p className="mt-4 max-w-[14ch] font-heading text-[3.25rem] font-extrabold leading-[1.04]">
            Homes and offices, kept ready.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5b6573]">
            Recurring residential and commercial cleaning with a simple weekly schedule.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[#3d4656]">
            {["Vetted, background-checked teams", "Photo-ready kitchens and baths", "Same cleaner on recurring plans"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-[#1d6fd1]" />
                  {item}
                </li>
              ),
            )}
          </ul>
          <div className="mt-7 flex items-center gap-4">
            <span className="rounded-full bg-[#1d6fd1] px-5 py-2.5 text-sm font-semibold text-white">
              Book a cleaning
            </span>
            <span className="text-sm text-[#5b6573]">Next opening: Thursday</span>
          </div>
        </div>
        <div className="relative min-h-0 overflow-hidden rounded-2xl shadow-[0_18px_40px_rgb(20_50_80_/_0.16)]">
          <Photo src={cleaningHero} className="absolute inset-0 size-full" position="center 35%" />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-4 px-10 pb-8">
        {[
          ["Standard clean", "Weekly", "Most booked"],
          ["Deep clean", "Seasonal", "From $249"],
          ["Move-out", "One-time", "Keys ready"],
        ].map(([title, cadence, note]) => (
          <div key={title} className="rounded-xl border border-[#e6ebf2] bg-white px-5 py-4">
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
    <div className="relative flex h-full flex-col text-[#eef1f4]" aria-hidden="true">
      <Photo src={autoHero} className="absolute inset-0 size-full opacity-55" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(12_15_20_/_0.94)_0%,rgb(12_15_20_/_0.72)_48%,rgb(12_15_20_/_0.28)_100%)]" />

      <div className="relative z-10 flex items-center justify-between px-10 py-2.5 text-[13px] text-white/65">
        <span>Mon–Sat · 7:30–6:00</span>
        <span className="font-heading font-semibold text-white">(512) 555-0172</span>
      </div>

      <div className="relative z-10 flex items-center justify-between border-y border-white/10 bg-black/30 px-10 py-4 backdrop-blur-[2px]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md border border-[#c45c2a] font-heading text-sm font-extrabold text-[#c45c2a]">
            N
          </span>
          <span className="font-heading text-xl font-extrabold tracking-tight">Northline Auto</span>
        </div>
        <div className="flex items-center gap-7 text-[13px] font-semibold text-white/80">
          <span>Services</span>
          <span>Tires</span>
          <span>Hours</span>
          <span className="rounded-md bg-[#c45c2a] px-4 py-2 text-white">Schedule</span>
        </div>
      </div>

      <div className="relative z-10 mt-auto px-10 pb-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#e09a72]">
          Diagnostics · Brakes · Tires
        </p>
        <p className="mt-3 max-w-[14ch] font-heading text-[3.3rem] font-extrabold leading-[1.02]">
          Service you can schedule.
        </p>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/75">
          Honest estimates, same-day diagnostics, and a shop that answers the phone.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="rounded-md bg-[#c45c2a] px-5 py-2.5 text-sm font-semibold">Book a drop-off</span>
          <span className="text-sm text-white/65">North Austin · Bay 3 open</span>
        </div>
        <div className="mt-8 grid max-w-xl grid-cols-4 gap-3 text-center">
          {["Brakes", "Tires", "Oil", "A/C"].map((item) => (
            <div key={item} className="rounded-lg bg-white/10 py-3 text-sm font-semibold ring-1 ring-white/12">
              {item}
            </div>
          ))}
        </div>
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
