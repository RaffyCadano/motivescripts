import { BrowserFrame } from "@/components/BrowserFrame";
import { MiniPage } from "@/components/MiniPage";
import type { Project } from "@/data/projects";
import { cn } from "@/lib/cn";
import treesHero from "@/assets/previews/trees-hero.jpg";
import treesChainsaw from "@/assets/previews/trees-chainsaw.jpg";
import treesStumpGrinder from "@/assets/previews/trees-stump-grinder.jpg";
import landscapeHero from "@/assets/previews/landscape-hero.jpg";
import landscapeStone from "@/assets/previews/landscape-stone.jpg";
import landscapeCare from "@/assets/previews/landscape-care.jpg";
import cleaningHero from "@/assets/previews/cleaning-hero.jpg";
import cleaningMopping from "@/assets/previews/cleaning-mopping.jpg";
import cleaningOfficeDesk from "@/assets/previews/cleaning-office-desk.jpg";
import autoHero from "@/assets/previews/auto-hero.jpg";
import autoTire from "@/assets/previews/auto-tire.jpg";
import autoBrakes from "@/assets/previews/auto-brakes.jpg";
import electricHero from "@/assets/previews/electric-hero.jpg";
import electricPanel from "@/assets/previews/electric-panel.jpg";
import electricEvCharger from "@/assets/previews/electric-ev-charger.jpg";
import homeServicesHero from "@/assets/previews/home-services-hero.jpg";
import homeServicesWindow from "@/assets/previews/home-services-window.jpg";
import homeServicesPaint from "@/assets/previews/home-services-paint.jpg";
import contractorHero from "@/assets/previews/contractor-hero.jpg";
import contractorKitchen from "@/assets/previews/contractor-kitchen.jpg";
import contractorFraming from "@/assets/previews/contractor-framing.jpg";
import restaurantHero from "@/assets/previews/restaurant-hero.jpg";
import restaurantPlatedDish from "@/assets/previews/restaurant-plated-dish.jpg";
import restaurantInterior from "@/assets/previews/restaurant-interior.jpg";
import salonHero from "@/assets/previews/salon-hero.jpg";
import salonColor from "@/assets/previews/salon-color.jpg";
import salonChairs from "@/assets/previews/salon-chairs.jpg";
import professionalServicesHero from "@/assets/previews/professional-services-hero.jpg";

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

const treeServices = [
  ["Tree removal", "Full takedown and haul-away, including hazard and storm-damaged trees."],
  ["Trimming & pruning", "Crown thinning and shaping for health, safety, and sightlines."],
  ["Stump grinding", "Grind below grade and haul the chips — yard ready to replant."],
  ["Storm cleanup", "Same-week response for downed limbs and storm damage."],
  ["Health assessments", "Certified arborist review with a written treatment plan."],
  ["Land clearing", "Lot and easement clearing for new construction or pasture."],
] as const;

const treeTestimonials = [
  ["Live Oak took down two dying oaks that were hanging over the roof. Clean job, cleaned up after themselves.", "Marcus D., South Austin"],
  ["Same week as the storm, when nobody else would even return a call. Fair price too.", "Priya K., Cedar Park"],
  ["Been using them for annual pruning for three years. Always on time, always tidy.", "The Renfros, Westlake"],
] as const;

export function TreesFullPage() {
  return (
    <div className="bg-white text-[#132018]" aria-hidden="true">
      <div className="relative flex h-[50rem] flex-col text-white">
        <Photo src={treesHero} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(5_14_10_/_0.88)_0%,rgb(5_14_10_/_0.55)_34%,rgb(5_14_10_/_0.18)_58%,transparent_78%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_14_10_/_0.42)_0%,transparent_24%,transparent_62%,rgb(5_14_10_/_0.55)_100%)]" />

        <div className="relative z-10 flex items-center justify-between px-10 py-2.5 text-[13px] text-white/75">
          <span>Licensed &amp; insured · Serving Austin</span>
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
            <span>Projects</span>
            <span>Reviews</span>
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
            <div key={title} className="rounded-lg bg-white/10 px-4 py-3.5 ring-1 ring-white/15 backdrop-blur-[3px]">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-[13px] text-white/70">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#2f8a4a]">
          What we do
        </p>
        <p className="mx-auto mt-3 max-w-xl text-center font-heading text-[2.4rem] font-extrabold leading-tight">
          Full-service tree care, start to cleanup.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {treeServices.map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#e3ece5] bg-[#f9fbf9] px-6 py-6">
              <p className="font-heading text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#5c6b60]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#f4f8f4] px-10 py-20">
        <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#2f8a4a]">
          Recent work
        </p>
        <p className="mx-auto mt-3 max-w-xl text-center font-heading text-[2.4rem] font-extrabold leading-tight">
          Projects around Austin.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            { src: treesHero, position: "center 30%", label: "Storm takedown, South Austin" },
            { src: treesChainsaw, position: "center 35%", label: "Hazard removal, Cedar Park" },
            { src: treesStumpGrinder, position: "center 40%", label: "Stump grinding, Westlake" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#2f8a4a", mixBlendMode: "multiply", opacity: 0.2 }} />
              </div>
              <p className="mt-2 text-[13px] font-medium text-[#4a5a4e]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#2f8a4a]">
          What Austin says
        </p>
        <p className="mx-auto mt-3 max-w-xl text-center font-heading text-[2.4rem] font-extrabold leading-tight">
          4.9 average, 180+ reviews.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {treeTestimonials.map(([quote, name]) => (
            <div key={name} className="rounded-xl border border-[#e3ece5] bg-[#f9fbf9] px-6 py-6">
              <Stars />
              <p className="mt-3 text-sm leading-relaxed text-[#3a463d]">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#2f8a4a]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0b1b12] px-10 py-16 text-center text-white">
        <p className="font-heading text-[2rem] font-extrabold">Ready for a healthier yard?</p>
        <p className="mx-auto mt-3 max-w-md text-white/75">
          Get a same-week estimate — no obligation, no pressure.
        </p>
        <span className="mt-6 inline-flex rounded-md bg-[#2f8a4a] px-6 py-3 font-heading text-sm font-semibold">
          Request a quote
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 px-10 py-14 text-[13px] text-[#5c6b60]">
        <div>
          <p className="font-heading text-base font-extrabold text-[#132018]">Live Oak Tree Co.</p>
          <p className="mt-2 leading-relaxed">Licensed &amp; insured residential and commercial tree care serving greater Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#132018]">Services</p>
          <div className="mt-3 space-y-2">
            <p>Tree removal</p>
            <p>Trimming &amp; pruning</p>
            <p>Stump grinding</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#132018]">Company</p>
          <div className="mt-3 space-y-2">
            <p>About</p>
            <p>Reviews</p>
            <p>Service area</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#132018]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0144</p>
            <p>hello@liveoaktreeco.com</p>
            <p>Serving Austin and nearby</p>
          </div>
        </div>
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
        <p
          className="mt-3 max-w-[16ch] text-[3.4rem] font-semibold leading-[1.04]"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
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

      <div className="shrink-0 px-10 pt-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1d6fd1]">Packages</p>
        <p className="mt-1 font-heading text-lg font-extrabold">Pick a plan, we handle the rest.</p>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-4 px-10 pb-6 pt-4">
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
          <p
            className="max-w-[13ch] text-[2.7rem] font-semibold uppercase leading-[1.05] tracking-tight"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
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
          <p
            className="mt-3 max-w-[13ch] text-[3.2rem] font-black uppercase leading-[1.02]"
            style={{ fontFamily: "'Anton', sans-serif" }}
          >
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
        <div className="relative h-full self-stretch overflow-hidden rounded-2xl">
          <Photo src={homeServicesHero} className="absolute inset-0 size-full" position="center 40%" />
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
      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-10">
        <Photo src={contractorHero} className="absolute inset-0 size-full" position="center 55%" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(28_35_42_/_0.92)_0%,rgb(28_35_42_/_0.72)_48%,rgb(28_35_42_/_0.3)_100%)]" />
        <div className="relative">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#e39a56]">
            Remodels · Additions · Renovations
          </p>
          <p
            className="mt-3 max-w-[16ch] text-[3.1rem] font-bold leading-[1.05]"
            style={{ fontFamily: "'Roboto Slab', serif" }}
          >
            Built the way you'd want your own house done.
          </p>
        </div>
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
      <div className="mt-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">
          Seasonal American Bistro
        </p>
        <p className="mt-3 max-w-[20ch] font-heading text-[2.9rem] italic leading-[1.1]" style={{ fontFamily: "'Playfair Display', serif"}}>
          Plates that change with the season.
        </p>
      </div>
      <div className="relative mt-6 h-[8.5rem] w-full max-w-xl overflow-hidden rounded-2xl">
        <Photo src={restaurantHero} className="absolute inset-0 size-full" position="center 35%" />
      </div>
      <p className="mt-9 text-center font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">
        Tonight's menu
      </p>
      <div className="mt-3 grid w-full max-w-xl grid-cols-1 gap-2 text-left">
        {[
          ["Roasted Beet Salad", "$14"],
          ["Pan-Seared Duck Breast", "$34"],
          ["Wild Mushroom Risotto", "$27"],
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
      <div className="relative flex min-h-0 flex-[1.4] flex-col justify-between px-10 py-8">
        <Photo src={salonHero} className="absolute inset-0 size-full" position="center 65%" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(32_27_28_/_0.55)_0%,rgb(32_27_28_/_0.55)_100%)]" />
        <span className="relative font-heading text-lg font-extrabold tracking-tight">Bloom &amp; Blade</span>
        <div className="relative">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#d99aa4]">
            Salon &amp; Barber
          </p>
          <p
            className="mt-3 max-w-[13ch] text-[2.9rem] font-semibold italic leading-[1.05]"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Cuts &amp; color, on your schedule.
          </p>
        </div>
        <span className="relative w-fit rounded-md bg-[#b76e79] px-5 py-2.5 text-sm font-semibold">Book Now</span>
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
      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-10">
        <Photo src={professionalServicesHero} className="absolute inset-0 size-full" position="center 60%" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(22_50_79_/_0.94)_0%,rgb(22_50_79_/_0.82)_55%,rgb(22_50_79_/_0.55)_100%)]" />
        <p className="relative font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#c9a24b]">
          Business Advisory &amp; Consulting
        </p>
        <p
          className="relative mt-3 max-w-[16ch] text-[2.7rem] font-semibold leading-[1.08]"
          style={{ fontFamily: "'Lora', serif" }}
        >
          Straight advice for the decisions that matter.
        </p>
        <p className="relative mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
          Clear recommendations from advisors who take the time to understand your business first.
        </p>
        <span className="relative mt-6 w-fit rounded-md bg-[#c9a24b] px-5 py-2.5 text-sm font-semibold text-[#16324f]">
          Schedule a Consultation
        </span>
      </div>
    </div>
  );
}

function SectionEyebrow({ children, color }: { children: string; color: string }) {
  return (
    <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.18em]" style={{ color }}>
      {children}
    </p>
  );
}

function SectionHeading({ children, fontFamily }: { children: string; fontFamily?: string }) {
  return (
    <p
      className={cn(
        "mx-auto mt-3 max-w-xl text-center text-[2.4rem] font-extrabold leading-tight",
        !fontFamily && "font-heading",
      )}
      style={fontFamily ? { fontFamily } : undefined}
    >
      {children}
    </p>
  );
}

function GalleryGrid({
  images,
  tint,
}: {
  images: { src: string; position?: string; label: string }[];
  /** Brand color wash over each photo -- keeps a reused base photo from reading as identical across galleries. */
  tint?: string;
}) {
  return (
    <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
      {images.map((item) => (
        <div key={item.label}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
            {tint ? (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: tint, mixBlendMode: "multiply", opacity: 0.22 }}
              />
            ) : null}
          </div>
          <p className="mt-2 text-[13px] font-medium text-[#5c6678]">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function RidgeLandscapeFullPage() {
  return (
    <div className="bg-[#f3efe4] text-[#243022]" aria-hidden="true">
      <div className="relative flex h-[42rem] flex-col text-[#f3efe4]">
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
            <p className="font-heading text-lg font-extrabold tracking-[0.22em]">RIDGE &amp; CO.</p>
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
          <p
            className="mt-3 max-w-[16ch] text-[3.4rem] font-semibold leading-[1.04]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
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

      <div className="px-10 py-20">
        <SectionEyebrow color="#5b7a4a">What we design</SectionEyebrow>
        <SectionHeading>Every layer of the yard, one studio.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Garden design", "Planting plans built for Austin's climate, not a catalog."],
            ["Hardscape & patios", "Stone, pavers, and structures that anchor the whole yard."],
            ["Seasonal care", "Scheduled maintenance so the design holds up year after year."],
            ["Irrigation", "Efficient systems zoned to what's actually planted."],
            ["Outdoor lighting", "Low-voltage lighting for evenings outside."],
            ["Drainage solutions", "Grading and drainage fixes before they become a bigger repair."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#ddd6c2] bg-white/60 px-6 py-6">
              <p className="font-heading text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#5c664f]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#243022] px-10 py-20 text-white">
        <SectionEyebrow color="#c5cdb8">Recent projects</SectionEyebrow>
        <SectionHeading>Gardens around Austin.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            { src: landscapeStone, position: "center", label: "Stone patio, Tarrytown" },
            { src: landscapeCare, position: "center 40%", label: "Garden refresh, Zilker" },
            { src: landscapeHero, position: "center 70%", label: "Full redesign, Barton Hills" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#5b7a4a", mixBlendMode: "multiply", opacity: 0.2 }} />
              </div>
              <p className="mt-2 text-[13px] font-medium text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#5b7a4a">Client notes</SectionEyebrow>
        <SectionHeading>A calmer way to redo the yard.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["They handled the whole thing — design, permits, build. The patio looks like it was always there.", "Elena R., Tarrytown"],
            ["First landscaper who actually showed us a plan before starting.", "Marcus B., Zilker"],
            ["Our irrigation bill dropped the season after they rezoned it.", "The Osei Family, Barton Hills"],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-xl border border-[#ddd6c2] bg-white/60 px-6 py-6">
              <p className="text-sm leading-relaxed text-[#3a4530]">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#5b7a4a]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#243022] px-10 py-16 text-center text-white">
        <p className="font-heading text-[2rem] font-extrabold">Start with a design conversation.</p>
        <p className="mx-auto mt-3 max-w-md text-white/75">No pressure — just a walk of the yard and a real plan.</p>
        <span className="mt-6 inline-flex rounded-md bg-[#f3efe4] px-6 py-3 font-heading text-sm font-semibold text-[#243022]">
          Start a project
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 px-10 py-14 text-[13px] text-[#5c664f]">
        <div>
          <p className="font-heading text-base font-extrabold tracking-[0.14em] text-[#243022]">RIDGE &amp; CO.</p>
          <p className="mt-2 leading-relaxed">Residential landscape design, build, and care around Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#243022]">Services</p>
          <div className="mt-3 space-y-2">
            <p>Garden design</p>
            <p>Hardscape</p>
            <p>Seasonal care</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#243022]">Studio</p>
          <div className="mt-3 space-y-2">
            <p>Our work</p>
            <p>Process</p>
            <p>Reviews</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#243022]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0122</p>
            <p>hello@ridgeandco.com</p>
            <p>Austin, TX</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarlowCleaningFullPage() {
  return (
    <div className="bg-white text-[#1c2430]" aria-hidden="true">
      <div className="flex items-center justify-between px-10 py-5">
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

      <div className="px-10 text-center">
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
        <div className="relative mx-10 mt-8 aspect-[16/6] overflow-hidden rounded-2xl">
          <Photo src={cleaningHero} className="absolute inset-0 size-full" position="center 35%" />
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#1d6fd1">Packages</SectionEyebrow>
        <SectionHeading>Pick a plan, we handle the rest.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            ["Standard clean", "Weekly", "Most booked"],
            ["Deep clean", "Seasonal", "From $249"],
            ["Move-out", "One-time", "Keys ready"],
            ["Office cleaning", "Weekday evenings", "Custom quote"],
            ["Post-construction", "One-time", "Dust to done"],
            ["Recurring plan", "Bi-weekly", "Most flexible"],
          ].map(([title, cadence, note]) => (
            <div key={title} className="rounded-xl border border-[#e6ebf2] bg-[#f7f9fc] px-5 py-4">
              <p className="text-[15px] font-semibold">{title}</p>
              <p className="mt-1 text-sm text-[#1d6fd1]">{cadence}</p>
              <p className="mt-0.5 text-[13px] text-[#7b8494]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#f2f6fc] px-10 py-20">
        <SectionEyebrow color="#1d6fd1">Recent bookings</SectionEyebrow>
        <SectionHeading>Homes and offices we've cleaned.</SectionHeading>
        <GalleryGrid
          tint="#1d6fd1"
          images={[
            { src: cleaningHero, position: "center 30%", label: "Deep clean, South Congress condo" },
            { src: cleaningMopping, position: "center", label: "Weekly service, Mueller home" },
            { src: cleaningOfficeDesk, position: "center", label: "Office cleaning, downtown suite" },
          ]}
        />
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#1d6fd1">Reviews</SectionEyebrow>
        <SectionHeading>4.9 average from 200+ homes.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Same crew every time, always on schedule. Haven't thought about cleaning in months.", "Dana W."],
            ["Booked the deep clean before move-in. House was spotless for the walkthrough.", "Chris & Alex T."],
            ["Our office looks better than it did when the last company had a whole team.", "Priya N., office manager"],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-xl border border-[#e6ebf2] bg-[#f7f9fc] px-6 py-6">
              <Stars />
              <p className="mt-3 text-sm leading-relaxed text-[#3c4451]">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#1d6fd1]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1d6fd1] px-10 py-16 text-center text-white">
        <p className="font-heading text-[2rem] font-extrabold">Ready for a spotless week?</p>
        <p className="mx-auto mt-3 max-w-md text-white/80">Book online in under two minutes.</p>
        <span className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-heading text-sm font-semibold text-[#1d6fd1]">
          Book now
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 px-10 py-14 text-[13px] text-[#5b6573]">
        <div>
          <p className="font-heading text-base font-extrabold text-[#1c2430]">Marlow Cleaning Co.</p>
          <p className="mt-2 leading-relaxed">Residential and commercial cleaning across Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#1c2430]">Services</p>
          <div className="mt-3 space-y-2">
            <p>Standard clean</p>
            <p>Deep clean</p>
            <p>Move-out</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#1c2430]">Company</p>
          <div className="mt-3 space-y-2">
            <p>Reviews</p>
            <p>Careers</p>
            <p>Service area</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#1c2430]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0188</p>
            <p>book@marlowcleaning.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NorthlineAutoFullPage() {
  return (
    <div className="bg-[#f6f3ed] text-[#1a1c1f]" aria-hidden="true">
      <div className="relative h-[38rem]">
        <Photo src={autoHero} className="absolute inset-0 size-full" position="center 38%" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-8 py-5">
          <span className="rounded-md bg-white/94 px-3 py-1.5 font-heading text-sm font-extrabold tracking-tight shadow-[0_8px_20px_rgb(0_0_0_/_0.12)]">
            Northline Auto
          </span>
          <div className="flex items-center gap-6 text-[13px] font-semibold text-white">
            <span>Services</span>
            <span>Hours</span>
            <span className="rounded-md bg-[#c45c2a] px-4 py-2 text-white shadow-[0_8px_20px_rgb(0_0_0_/_0.16)]">
              Schedule
            </span>
          </div>
        </div>
      </div>

      <div className="border-t-4 border-[#c45c2a] px-8 py-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c45c2a]">
          Diagnostics · Brakes · Tires
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <p
            className="max-w-[13ch] text-[2.7rem] font-semibold uppercase leading-[1.05] tracking-tight"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            Service you can schedule.
          </p>
          <p className="max-w-xs text-[15px] leading-relaxed text-[#5c564c]">
            Honest estimates, same-day diagnostics, and a shop that answers the phone.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {["Brakes", "Tires", "Oil", "A/C"].map((item) => (
            <span key={item} className="rounded-full border border-[#e4dfd4] bg-white px-3.5 py-1.5 text-[13px] font-semibold">
              {item}
            </span>
          ))}
          <span className="ml-auto text-[13px] text-[#7a7468]">Mon–Sat · North Austin</span>
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#c45c2a">What we service</SectionEyebrow>
        <SectionHeading>Everything short of the dealership.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Diagnostics", "Check-engine and drivability issues, explained plainly."],
            ["Brakes", "Pads, rotors, and full brake service."],
            ["Tires", "Rotation, balancing, and replacement."],
            ["Oil changes", "Conventional, synthetic blend, and full synthetic."],
            ["A/C service", "Recharge and repair before the Austin summer hits."],
            ["Batteries", "Testing and replacement, most makes and models."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#e4dfd4] bg-white px-6 py-6">
              <p className="font-heading text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#6b665a]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1a1c1f] px-10 py-20 text-white">
        <SectionEyebrow color="#e3927a">Recent work</SectionEyebrow>
        <SectionHeading>In the bay this month.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            { src: autoBrakes, position: "center 20%", label: "Brake job, F-150" },
            { src: autoHero, position: "center 50%", label: "Diagnostics, Civic" },
            { src: autoTire, position: "center 40%", label: "Tire swap, fleet van" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#c45c2a", mixBlendMode: "multiply", opacity: 0.2 }} />
              </div>
              <p className="mt-2 text-[13px] font-medium text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#c45c2a">Reviews</SectionEyebrow>
        <SectionHeading>Straight answers, fair prices.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Told me exactly what needed fixing now versus later. No upsell.", "Jordan P."],
            ["Same-day brake job, got a loaner while I waited. Easy.", "Renee K."],
            ["Been coming here for three cars now. Never a surprise on the bill.", "Tom H."],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-xl border border-[#e4dfd4] bg-white px-6 py-6">
              <p className="text-sm leading-relaxed text-[#3a362d]">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#c45c2a]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#c45c2a] px-10 py-16 text-center text-white">
        <p className="font-heading text-[2rem] font-extrabold">Something feel off?</p>
        <p className="mx-auto mt-3 max-w-md text-white/85">Schedule a diagnostic before it turns into a bigger repair.</p>
        <span className="mt-6 inline-flex rounded-md bg-white px-6 py-3 font-heading text-sm font-semibold text-[#c45c2a]">
          Schedule service
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 px-10 py-14 text-[13px] text-[#6b665a]">
        <div>
          <p className="font-heading text-base font-extrabold text-[#1a1c1f]">Northline Auto</p>
          <p className="mt-2 leading-relaxed">Independent auto repair and maintenance, North Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#1a1c1f]">Services</p>
          <div className="mt-3 space-y-2">
            <p>Diagnostics</p>
            <p>Brakes</p>
            <p>Tires</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#1a1c1f]">Shop</p>
          <div className="mt-3 space-y-2">
            <p>Hours</p>
            <p>Reviews</p>
            <p>Directions</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#1a1c1f]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0133</p>
            <p>Mon–Sat, 8am–6pm</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RedlineElectricFullPage() {
  return (
    <div className="bg-[#111111] text-[#f4f1e8]" aria-hidden="true">
      <div className="relative h-[40rem]">
        <Photo src={electricHero} className="absolute inset-0 size-full" position="center 35%" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(17_17_17_/_0.94)_0%,rgb(17_17_17_/_0.7)_46%,rgb(17_17_17_/_0.18)_100%)]" />
        <div className="relative flex h-full">
          <div className="flex w-[8.5rem] shrink-0 flex-col items-center justify-between bg-[#f0c400] py-8 text-[#111111]">
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
          <div className="flex min-h-0 flex-1 flex-col justify-between px-10 py-8">
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
              <p
                className="mt-3 max-w-[13ch] text-[3.2rem] font-black uppercase leading-[1.02]"
                style={{ fontFamily: "'Anton', sans-serif" }}
              >
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
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#f0c400">Full-service electrical</SectionEyebrow>
        <SectionHeading>Residential work, done to code.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Emergency repairs", "Same-night response for outages and hazards."],
            ["Panel upgrades", "200-amp upgrades for growing electrical loads."],
            ["EV chargers", "Level 2 charger installs, permitted and inspected."],
            ["Whole-home lighting", "Interior, exterior, and landscape lighting circuits."],
            ["Rewiring", "Older homes brought up to current code."],
            ["Safety inspections", "Pre-sale and insurance-required inspections."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-white/5 px-6 py-6">
              <p className="font-heading text-base font-bold text-[#f0c400]">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#f0c400] px-10 py-20 text-[#111111]">
        <SectionEyebrow color="#111111">Recent calls</SectionEyebrow>
        <SectionHeading>Panels, chargers, and midnight calls.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            { src: electricPanel, position: "center 20%", label: "Panel upgrade, Allandale" },
            { src: electricEvCharger, position: "center 30%", label: "EV charger, Mueller garage" },
            { src: electricHero, position: "center 70%", label: "Emergency call, 11pm" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#111111", mixBlendMode: "multiply", opacity: 0.12 }} />
              </div>
              <p className="mt-2 text-[13px] font-medium">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#f0c400">Reviews</SectionEyebrow>
        <SectionHeading>Answered the phone at midnight.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Power went out at 11pm, they were at the house by midnight. Fixed in an hour.", "Sam R."],
            ["Panel upgrade and EV charger in one visit, inspected and done.", "The Alavis"],
            ["Only electrician who returned my call the same day.", "Danielle M."],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-lg border border-white/10 bg-white/5 px-6 py-6">
              <p className="text-sm leading-relaxed text-white/85">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#f0c400]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-16 text-center">
        <p className="font-heading text-[2rem] font-extrabold">Something not working right?</p>
        <p className="mx-auto mt-3 max-w-md text-white/70">Emergency and scheduled visits, same number, day or night.</p>
        <span className="mt-6 inline-flex rounded-md bg-[#f0c400] px-6 py-3 font-heading text-sm font-semibold text-[#111111]">
          Request a visit
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 border-t border-white/10 px-10 py-14 text-[13px] text-white/60">
        <div>
          <p className="font-heading text-base font-extrabold text-white">Redline Electric</p>
          <p className="mt-2 leading-relaxed">Licensed residential electrician, 24-hour emergency service.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Services</p>
          <div className="mt-3 space-y-2">
            <p>Panels</p>
            <p>EV chargers</p>
            <p>Lighting</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Company</p>
          <div className="mt-3 space-y-2">
            <p>Reviews</p>
            <p>Licensing</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0190</p>
            <p>24-hour dispatch</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnchorPointFullPage() {
  return (
    <div className="bg-[#f7fafc] text-[#132436]" aria-hidden="true">
      <div className="flex items-center justify-between px-10 py-2.5 text-[13px] text-[#4f6478]">
        <span>Licensed · Insured · Background-checked</span>
        <span className="font-heading font-semibold text-[#2b5f8a]">(512) 555-0171</span>
      </div>
      <div className="flex items-center justify-between border-y border-[#dbe6ee] bg-white px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-[#2b5f8a] font-heading text-sm font-extrabold text-white">
            A
          </span>
          <span className="font-heading text-xl font-extrabold tracking-tight">Anchor Point</span>
        </div>
        <span className="rounded-md bg-[#e07b39] px-4 py-2 text-sm font-semibold text-white">Get an estimate</span>
      </div>
      <div className="grid grid-cols-[1.2fr_1fr] items-center gap-10 px-10 py-16">
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
        <div className="relative aspect-[16/11] overflow-hidden rounded-2xl">
          <Photo src={homeServicesHero} className="absolute inset-0 size-full" position="center 40%" />
        </div>
      </div>

      <div className="bg-white px-10 py-20">
        <SectionEyebrow color="#2b5f8a">What's on the list</SectionEyebrow>
        <SectionHeading>The repairs everyone puts off.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Plumbing repairs", "Leaks, fixtures, and small plumbing fixes."],
            ["Drywall & paint", "Patch, texture, and paint touch-ups."],
            ["Door & window repair", "Sticking doors, broken hardware, drafty windows."],
            ["Gutter service", "Cleaning, repair, and guard installation."],
            ["Handyman punch lists", "One visit for the whole list, not one trip per item."],
            ["Small remodels", "Bathroom refreshes and small kitchen updates."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-xl border border-[#dbe6ee] bg-[#f7fafc] px-6 py-6">
              <p className="font-heading text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#4f6478]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#e07b39">Recent visits</SectionEyebrow>
        <SectionHeading>One call, list handled.</SectionHeading>
        <GalleryGrid
          tint="#2b5f8a"
          images={[
            { src: homeServicesWindow, position: "center 30%", label: "Window repair, Round Rock" },
            { src: homeServicesPaint, position: "center 20%", label: "Interior paint, Pflugerville" },
            { src: homeServicesHero, position: "center 65%", label: "Gutter service, Georgetown" },
          ]}
        />
      </div>

      <div className="bg-[#132436] px-10 py-20 text-white">
        <SectionEyebrow color="#e07b39">Homeowners say</SectionEyebrow>
        <SectionHeading>Finally, a trustworthy handyman.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Background check gave me peace of mind letting them in while I was at work.", "Laura M."],
            ["Fixed six things on my list in one visit. Wish I'd called sooner.", "David O."],
            ["Upfront price before they started, no surprise add-ons after.", "The Nguyens"],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-xl border border-white/10 bg-white/5 px-6 py-6">
              <p className="text-sm leading-relaxed text-white/85">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#e07b39]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#e07b39] px-10 py-16 text-center text-white">
        <p className="font-heading text-[2rem] font-extrabold">Got a list piling up?</p>
        <p className="mx-auto mt-3 max-w-md text-white/85">Free estimate, same-week scheduling.</p>
        <span className="mt-6 inline-flex rounded-md bg-white px-6 py-3 font-heading text-sm font-semibold text-[#e07b39]">
          Get an estimate
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 bg-white px-10 py-14 text-[13px] text-[#4f6478]">
        <div>
          <p className="font-heading text-base font-extrabold text-[#132436]">Anchor Point</p>
          <p className="mt-2 leading-relaxed">Licensed, insured, background-checked home repair.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#132436]">Services</p>
          <div className="mt-3 space-y-2">
            <p>Plumbing</p>
            <p>Drywall &amp; paint</p>
            <p>Small remodels</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#132436]">Company</p>
          <div className="mt-3 space-y-2">
            <p>Reviews</p>
            <p>Service area</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#132436]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0171</p>
            <p>hello@anchorpointhome.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FieldstoneConstructionFullPage() {
  return (
    <div className="bg-[#1c232a] text-white" aria-hidden="true">
      <div className="flex items-center justify-between px-10 py-6">
        <span className="font-heading text-lg font-extrabold tracking-tight">Fieldstone Construction</span>
        <div className="flex items-center gap-7 text-[13px] font-semibold text-white/70">
          <span>Projects</span>
          <span>Process</span>
          <span className="rounded-md bg-[#d9731c] px-4 py-2 text-sm font-semibold text-white">Free Estimate</span>
        </div>
      </div>
      <div className="relative flex h-[36rem] flex-col justify-center px-10">
        <Photo src={contractorHero} className="absolute inset-0 size-full" position="center 55%" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(28_35_42_/_0.92)_0%,rgb(28_35_42_/_0.72)_48%,rgb(28_35_42_/_0.3)_100%)]" />
        <div className="relative">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#e39a56]">
            Remodels · Additions · Renovations
          </p>
          <p
            className="mt-3 max-w-[16ch] text-[3.1rem] font-bold leading-[1.05]"
            style={{ fontFamily: "'Roboto Slab', serif" }}
          >
            Built the way you'd want your own house done.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
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

      <div className="px-10 py-20">
        <SectionEyebrow color="#e39a56">What we build</SectionEyebrow>
        <SectionHeading>From one room to the whole house.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Kitchen remodels", "Full gut renovations to targeted updates."],
            ["Bathroom remodels", "Layout changes, fixtures, and finishes."],
            ["Room additions", "Additions that match the existing structure."],
            ["Whole-home renovations", "Coordinated, phased renovations, room by room."],
            ["Decks & outdoor living", "Decks, covered patios, and outdoor kitchens."],
            ["Design-build", "One team from concept through final walkthrough."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-white/5 px-6 py-6">
              <p className="font-heading text-base font-bold text-[#e39a56]">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white px-10 py-20 text-[#1c232a]">
        <SectionEyebrow color="#c45c2a">Recent projects</SectionEyebrow>
        <SectionHeading>Proof, not just a promise.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            { src: contractorKitchen, position: "center 40%", label: "Kitchen remodel, Rollingwood" },
            { src: contractorFraming, position: "center 40%", label: "Addition, Circle C" },
            { src: contractorHero, position: "center 70%", label: "Outdoor living, Steiner Ranch" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#d9731c", mixBlendMode: "multiply", opacity: 0.16 }} />
              </div>
              <p className="mt-2 text-[13px] font-medium text-[#5c6678]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#e39a56">Client notes</SectionEyebrow>
        <SectionHeading>No surprises on the invoice.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Fixed-price contract, and they stuck to it exactly. Kitchen came out better than the rendering.", "The Halversons"],
            ["Eighteen years shows. Every sub they used knew the job.", "Renata C."],
            ["Addition matches the original house so well you can't tell where it starts.", "Marcus T."],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-lg border border-white/10 bg-white/5 px-6 py-6">
              <p className="text-sm leading-relaxed text-white/85">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#e39a56]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#d9731c] px-10 py-16 text-center">
        <p className="font-heading text-[2rem] font-extrabold">Planning a remodel?</p>
        <p className="mx-auto mt-3 max-w-md text-white/90">Get a free, fixed-price estimate before you commit.</p>
        <span className="mt-6 inline-flex rounded-md bg-white px-6 py-3 font-heading text-sm font-semibold text-[#d9731c]">
          Free Estimate
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 border-t border-white/10 px-10 py-14 text-[13px] text-white/60">
        <div>
          <p className="font-heading text-base font-extrabold text-white">Fieldstone Construction</p>
          <p className="mt-2 leading-relaxed">Remodels, additions, and renovations across Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Services</p>
          <div className="mt-3 space-y-2">
            <p>Kitchens</p>
            <p>Bathrooms</p>
            <p>Additions</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Company</p>
          <div className="mt-3 space-y-2">
            <p>Our projects</p>
            <p>Process</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0155</p>
            <p>estimates@fieldstonebuild.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AmberForkFullPage() {
  return (
    <div className="bg-[#faf3ee] text-[#3a1219]" aria-hidden="true">
      <div className="flex items-center justify-between px-10 py-6 text-[13px] font-semibold text-[#7a2331]">
        <span>The Amber Fork</span>
        <span className="flex gap-6 uppercase tracking-[0.12em] text-[#a8636f]">
          <span>Menu</span>
          <span>About</span>
          <span>Reserve</span>
        </span>
      </div>
      <div className="px-10 text-center">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">
          Seasonal American Bistro
        </p>
        <p
          className="mx-auto mt-3 max-w-[20ch] font-heading text-[2.9rem] italic leading-[1.1]"
          style={{ fontFamily: "'Playfair Display', serif"}}
        >
          Plates that change with the season.
        </p>
        <div className="relative mx-10 mt-6 aspect-[16/6] overflow-hidden rounded-2xl">
          <Photo src={restaurantHero} className="absolute inset-0 size-full" position="center 35%" />
        </div>
      </div>

      <div className="px-10 py-16">
        <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">
          Tonight's menu
        </p>
        <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-2 text-left">
          {[
            ["Roasted Beet Salad", "$14"],
            ["Pan-Seared Duck Breast", "$34"],
            ["Wild Mushroom Risotto", "$27"],
            ["Dark Chocolate Tart", "$11"],
          ].map(([dish, price]) => (
            <div key={dish} className="flex items-baseline justify-between border-b border-[#e6d3ca] py-2">
              <span className="font-heading text-[15px] font-semibold">{dish}</span>
              <span className="mx-3 flex-1 border-b border-dotted border-[#c9a8a0]" />
              <span className="font-heading text-[15px] font-bold text-[#7a2331]">{price}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <span className="inline-flex rounded-md bg-[#7a2331] px-6 py-2.5 text-sm font-semibold text-white">
            Reserve a Table
          </span>
        </div>
      </div>

      <div className="bg-[#7a2331] px-10 py-20 text-white">
        <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#e6c4b0]">
          The dining room
        </p>
        <p
          className="mx-auto mt-3 max-w-lg text-center text-[2rem] italic leading-tight"
          style={{ fontFamily: "'Playfair Display', serif"}}
        >
          Warm, quiet, and built for a slow dinner.
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-3 gap-4">
          {[
            { src: restaurantInterior, position: "center", label: "Dining room" },
            { src: restaurantHero, position: "center 50%", label: "Bar seating" },
            { src: restaurantPlatedDish, position: "center", label: "Tonight's plate" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#7a2331", mixBlendMode: "multiply", opacity: 0.2 }} />
              </div>
              <p className="mt-2 text-center text-[13px] text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20 text-center">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">In their words</p>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-3 gap-6 text-left">
          {[
            ["The menu actually changes — went back a month later and half the plates were new.", "Austin Monthly"],
            ["Best duck breast in the city, quietly, without the hype.", "Sarah L."],
            ["Reserved a table in thirty seconds from my phone. Rare for a place this good.", "Marcus F."],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-xl border border-[#e6d3ca] bg-white/50 px-6 py-6">
              <p className="text-sm italic leading-relaxed text-[#5a2530]" style={{ fontFamily: "'Playfair Display', serif"}}>
                “{quote}”
              </p>
              <p className="mt-4 text-[13px] font-semibold text-[#7a2331]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 pb-16 text-center">
        <span className="rounded-md bg-[#7a2331] px-6 py-2.5 text-sm font-semibold text-white">Reserve a Table</span>
      </div>

      <div className="grid grid-cols-3 gap-8 border-t border-[#e6d3ca] px-10 py-14 text-[13px] text-[#8a5560]">
        <div>
          <p className="font-heading text-base font-extrabold text-[#3a1219]">The Amber Fork</p>
          <p className="mt-2 leading-relaxed">Seasonal American bistro, downtown Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#3a1219]">Hours</p>
          <div className="mt-3 space-y-2">
            <p>Tue–Sun, 5–10pm</p>
            <p>Bar opens at 4pm</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#3a1219]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0119</p>
            <p>reserve@theamberfork.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BloomAndBladeFullPage() {
  return (
    <div className="bg-[#2f2325] text-white" aria-hidden="true">
      <div className="relative flex h-[38rem] flex-col justify-between px-10 py-8">
        <Photo src={salonHero} className="absolute inset-0 size-full" position="center 65%" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(32_27_28_/_0.55)_0%,rgb(32_27_28_/_0.55)_100%)]" />
        <div className="relative flex items-center justify-between">
          <span className="font-heading text-lg font-extrabold tracking-tight">Bloom &amp; Blade</span>
          <div className="flex items-center gap-6 text-[13px] font-semibold text-white/85">
            <span>Services</span>
            <span>Team</span>
            <span className="rounded-md bg-[#b76e79] px-4 py-2 text-white">Book Now</span>
          </div>
        </div>
        <div className="relative">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#d99aa4]">Salon &amp; Barber</p>
          <p
            className="mt-3 max-w-[13ch] text-[2.9rem] font-semibold italic leading-[1.05]"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Cuts &amp; color, on your schedule.
          </p>
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#d99aa4">Popular services</SectionEyebrow>
        <SectionHeading>Real pricing, no phone call needed.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4">
          {[
            ["Women's Cut", "$65"],
            ["Men's Cut", "$40"],
            ["Full Color", "$95"],
            ["Beard Trim", "$20"],
            ["Balayage", "$165"],
            ["Blowout", "$45"],
          ].map(([service, price]) => (
            <div key={service} className="flex items-baseline justify-between rounded-lg bg-white/5 px-5 py-3.5">
              <span className="text-sm font-semibold">{service}</span>
              <span className="font-heading text-sm font-bold text-[#e3aeb5]">{price}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white px-10 py-20 text-[#2f2325]">
        <SectionEyebrow color="#b76e79">The studio</SectionEyebrow>
        <SectionHeading>Where to find your new look.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-4">
          {[
            { src: salonColor, position: "center 30%", label: "Color bar" },
            { src: salonChairs, position: "center 45%", label: "Barber chairs" },
            { src: salonHero, position: "center 75%", label: "Front lounge" },
          ].map((item) => (
            <div key={item.label}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={item.src} className="absolute inset-0 size-full" position={item.position} />
                <div className="absolute inset-0" style={{ backgroundColor: "#b76e79", mixBlendMode: "multiply", opacity: 0.2 }} />
              </div>
              <p className="mt-2 text-[13px] font-medium text-[#5c6678]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#d99aa4">Client love</SectionEyebrow>
        <SectionHeading>Booked out weeks, worth the wait.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Saw the pricing online, booked same day. No surprises at checkout.", "Kayla R."],
            ["Best balayage I've had in Austin, and I've tried a lot of salons.", "Priya S."],
            ["My barber knows exactly what I want without me saying much.", "Tomas G."],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-xl bg-white/5 px-6 py-6">
              <p className="text-sm leading-relaxed text-white/85">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#e3aeb5]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#b76e79] px-10 py-16 text-center">
        <p className="font-heading text-[2rem] font-extrabold">Ready for something new?</p>
        <p className="mx-auto mt-3 max-w-md text-white/90">Book online, pick your stylist or barber.</p>
        <span className="mt-6 inline-flex rounded-md bg-white px-6 py-3 font-heading text-sm font-semibold text-[#b76e79]">
          Book Now
        </span>
      </div>

      <div className="grid grid-cols-3 gap-8 border-t border-white/10 px-10 py-14 text-[13px] text-white/60">
        <div>
          <p className="font-heading text-base font-extrabold text-white">Bloom &amp; Blade</p>
          <p className="mt-2 leading-relaxed">Salon and barbershop, downtown Austin.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Hours</p>
          <div className="mt-3 space-y-2">
            <p>Tue–Sat, 9am–7pm</p>
            <p>Sun–Mon closed</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-white">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0166</p>
            <p>book@bloomandblade.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KestrelAdvisoryFullPage() {
  return (
    <div className="bg-white text-[#16324f]" aria-hidden="true">
      <div className="flex h-[38rem] text-white">
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
        <div className="relative flex min-h-0 flex-1 flex-col justify-center px-10">
          <Photo src={professionalServicesHero} className="absolute inset-0 size-full" position="center 60%" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(22_50_79_/_0.94)_0%,rgb(22_50_79_/_0.82)_55%,rgb(22_50_79_/_0.55)_100%)]" />
          <p className="relative font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#c9a24b]">
            Business Advisory &amp; Consulting
          </p>
          <p
            className="relative mt-3 max-w-[16ch] text-[2.7rem] font-semibold leading-[1.08]"
            style={{ fontFamily: "'Lora', serif" }}
          >
            Straight advice for the decisions that matter.
          </p>
          <p className="relative mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
            Clear recommendations from advisors who take the time to understand your business first.
          </p>
          <span className="relative mt-6 w-fit rounded-md bg-[#c9a24b] px-5 py-2.5 text-sm font-semibold text-[#16324f]">
            Schedule a Consultation
          </span>
        </div>
      </div>

      <div className="px-10 py-20">
        <SectionEyebrow color="#c9a24b">What we advise on</SectionEyebrow>
        <SectionHeading>Specific outcomes, not generic advice.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Financial planning", "Long-range planning for owners and executives."],
            ["Business strategy", "Growth and operating strategy grounded in your numbers."],
            ["M&A advisory", "Buy-side and sell-side guidance through close."],
            ["Succession planning", "Ownership transitions planned years in advance."],
            ["Risk management", "Identify and price the risks that actually matter."],
            ["Executive coaching", "One-on-one advising for founders and leadership teams."],
          ].map(([title, note]) => (
            <div key={title} className="rounded-lg border border-[#e3e8ee] bg-[#f8fafc] px-6 py-6">
              <p className="font-heading text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#5c6f82]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0f2338] px-10 py-20 text-white">
        <SectionEyebrow color="#c9a24b">Client results</SectionEyebrow>
        <SectionHeading>Advice that changed the decision.</SectionHeading>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {[
            ["Walked us through a sale process we'd never done before, start to finish.", "Founder, logistics company"],
            ["First advisor who gave us a number instead of a vague opinion.", "CFO, healthcare services"],
            ["Succession plan they built saved us two years of guessing.", "Family-owned manufacturer"],
          ].map(([quote, name]) => (
            <div key={name} className="rounded-lg border border-white/10 bg-white/5 px-6 py-6">
              <p className="text-sm leading-relaxed text-white/85">“{quote}”</p>
              <p className="mt-4 text-[13px] font-semibold text-[#c9a24b]">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#c9a24b] px-10 py-16 text-center text-[#16324f]">
        <p className="font-heading text-[2rem] font-extrabold">Have a decision on the table?</p>
        <p className="mx-auto mt-3 max-w-md">Talk to an advisor before you commit either way.</p>
        <span className="mt-6 inline-flex rounded-md bg-[#16324f] px-6 py-3 font-heading text-sm font-semibold text-white">
          Schedule a Consultation
        </span>
      </div>

      <div className="grid grid-cols-4 gap-8 px-10 py-14 text-[13px] text-[#5c6f82]">
        <div>
          <p className="font-heading text-base font-extrabold text-[#16324f]">Kestrel Advisory</p>
          <p className="mt-2 leading-relaxed">Business advisory and financial consulting.</p>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#16324f]">Services</p>
          <div className="mt-3 space-y-2">
            <p>Financial planning</p>
            <p>Strategy</p>
            <p>M&amp;A</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#16324f]">Firm</p>
          <div className="mt-3 space-y-2">
            <p>Advisors</p>
            <p>Results</p>
          </div>
        </div>
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#16324f]">Contact</p>
          <div className="mt-3 space-y-2">
            <p>(512) 555-0104</p>
            <p>consult@kestreladvisory.com</p>
          </div>
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
