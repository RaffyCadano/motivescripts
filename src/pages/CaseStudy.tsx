import { useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/Button";
import { FullSitePreview } from "@/components/FullSitePreview";
import {
  AmberForkFullPage,
  AnchorPointFullPage,
  BloomAndBladeFullPage,
  FieldstoneConstructionFullPage,
  KestrelAdvisoryFullPage,
  MarlowCleaningFullPage,
  NorthlineAutoFullPage,
  RedlineElectricFullPage,
  RidgeLandscapeFullPage,
  SitePreview,
  TreesFullPage,
} from "@/components/SitePreview";
import { getProject, type Project } from "@/data/projects";
import { usePageMeta } from "@/lib/usePageMeta";

/** Every project now has a full, multi-section scrollable page for the lightbox. */
const fullPagesByPreview: Partial<Record<Project["preview"], () => ReactElement>> = {
  trees: TreesFullPage,
  landscape: RidgeLandscapeFullPage,
  cleaning: MarlowCleaningFullPage,
  auto: NorthlineAutoFullPage,
  electric: RedlineElectricFullPage,
  home_services: AnchorPointFullPage,
  contractor: FieldstoneConstructionFullPage,
  restaurant: AmberForkFullPage,
  salon: BloomAndBladeFullPage,
  professional_services: KestrelAdvisoryFullPage,
};

// Each mock "client" uses its own display typeface so the projects don't all
// read as one brand. Loaded dynamically (not in index.html) so the rest of
// the site -- home, pricing, contact -- never pays for fonts only used here.
const CASE_STUDY_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Anton&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Fraunces:ital,wght@0,600;0,700;1,600&family=Lora:ital,wght@0,600;0,700&family=Oswald:wght@500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&family=Roboto+Slab:wght@600;700&display=swap";

function useCaseStudyFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${CASE_STUDY_FONTS_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CASE_STUDY_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 fill-none stroke-current" strokeWidth={1.75} aria-hidden="true">
      <path d="M7.5 3H3v4.5M12.5 3H17v4.5M7.5 17H3v-4.5M12.5 17H17v-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SitePreviewLightbox({ project, onClose }: { project: Project; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const fullPage = fullPagesByPreview[project.preview];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} preview`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgb(5_10_20_/_0.72)] pt-10 backdrop-blur-sm"
    >
      <button type="button" className="absolute inset-0" aria-label="Close preview" onClick={onClose} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-1 z-20 grid size-9 place-items-center rounded-full text-lg leading-none text-white/80 transition-colors hover:text-white"
      >
        ✕
      </button>
      <div className="relative w-full">
        {fullPage ? (
          <div className="overflow-hidden rounded-t-[var(--radius-lg)] bg-white shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 border-b border-[rgb(0_80_240_/_0.28)] bg-[rgb(0_80_240_/_0.03)] px-3 py-2.5">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="size-2 rounded-full bg-[#c5ccd6]" />
                <span className="size-2 rounded-full bg-[#c5ccd6]" />
                <span className="size-2 rounded-full bg-[#c5ccd6]" />
              </div>
              <p className="min-w-0 flex-1 truncate rounded-full bg-[rgb(0_16_48_/_0.04)] px-3 py-1 text-center font-heading text-[10px] tracking-wide text-faint">
                {project.slug.replace(/-/g, "")}.com
              </p>
            </div>
            <div className="h-[90vh] overflow-y-auto overscroll-contain">
              <FullSitePreview>{fullPage()}</FullSitePreview>
            </div>
          </div>
        ) : (
          <SitePreview project={project} />
        )}
      </div>
    </div>,
    document.body,
  );
}

export function CaseStudyPage() {
  const { slug } = useParams();
  const project = slug ? getProject(slug) : undefined;
  const [previewOpen, setPreviewOpen] = useState(false);
  useCaseStudyFonts();

  usePageMeta(
    project ? `${project.name} — MotiveScripts` : "Project not found — MotiveScripts",
    project ? project.summary : "That case study does not exist.",
    project ? `/work/${project.slug}` : "/work",
  );

  if (!project) {
    return (
      <main id="main" className="container-site py-24">
        <h1 className="text-3xl">Project not found</h1>
        <p className="mt-4 text-muted">That case study does not exist.</p>
        <Link className="mt-6 inline-block text-cyan" to="/work">
          Back to work
        </Link>
      </main>
    );
  }

  return (
    <main id="main">
      <header className="border-b border-[var(--color-line)] py-16 md:py-20">
        <div className="container-wide">
          <p className="text-sm text-faint">
            <Link to="/work" className="hover:text-ink">
              Work
            </Link>
            <span aria-hidden="true"> / </span>
            {project.name}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
              Concept project
            </span>
            <span className="text-sm text-muted">{project.industry}</span>
          </div>
          <h1 className="mt-4 max-w-[18ch] text-[2.15rem] md:text-[3.25rem]">{project.name}</h1>
          <p className="mt-3 text-muted-strong">{project.services}</p>
          <p className="mt-5 max-w-2xl text-lg text-muted">{project.summary}</p>
        </div>
      </header>

      <div className="container-wide py-12 md:py-16">
        <div className="group relative">
          <SitePreview project={project} />
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] bg-[rgb(5_10_20_/_0)] opacity-0 transition-all duration-300 group-hover:bg-[rgb(5_10_20_/_0.32)] group-hover:opacity-100 focus-visible:opacity-100"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-heading text-sm font-semibold text-ink shadow-[var(--shadow-card)] transition-transform duration-300 translate-y-2 group-hover:translate-y-0">
              <ExpandIcon />
              Preview
            </span>
          </button>
        </div>
        {previewOpen ? <SitePreviewLightbox project={project} onClose={() => setPreviewOpen(false)} /> : null}

        <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:items-start lg:gap-x-24">
          <section>
            <h2 className="text-xl">The brief</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{project.challenge}</p>
          </section>
          <section className="lg:col-span-2 lg:row-span-2">
            <h2 className="text-xl">How we would approach it</h2>
            <ol className="mt-4 space-y-3">
              {project.approach.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-muted">
                  <span className="font-heading font-bold text-cyan">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-2xl text-sm text-muted">{project.outcome}</p>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button to="/start-a-project" size="lg">
              Start a Project
            </Button>
            <Button to="/work" variant="secondary" size="lg">
              All work
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
