import { lazy, Suspense } from "react";
import { CTA } from "@/components/CTA";
import { AboutTeaserSection } from "@/sections/AboutTeaserSection";
import { FAQSection } from "@/sections/FAQSection";
import { HeroSection } from "@/sections/HeroSection";
import { PricingSection } from "@/sections/PricingSection";
import { ProcessSection } from "@/sections/ProcessSection";
import { ServicesSection } from "@/sections/ServicesSection";
import { TestimonialsSection } from "@/sections/TestimonialsSection";
import { TrustSection } from "@/sections/TrustSection";
import { WhySection } from "@/sections/WhySection";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

// Lazy: pulls in SitePreview.tsx (~2000 lines, ~30 per-project mockup
// images) just to render a few project cards -- see App.tsx's CaseStudy/Work
// lazy imports for the fuller explanation of why that module shouldn't be in
// the eagerly-loaded main bundle.
const WorkSection = lazy(() => import("@/sections/WorkSection").then((m) => ({ default: m.WorkSection })));

export function HomePage() {
  const meta = seoPage("/");
  usePageMeta(meta.title, meta.description, meta.path);

  return (
    <main id="main">
      <HeroSection />
      <TrustSection />
      <ServicesSection />
      <WhySection />
      <Suspense fallback={null}>
        <WorkSection />
      </Suspense>
      <ProcessSection />
      <PricingSection />
      <TestimonialsSection />
      <AboutTeaserSection />
      <FAQSection />
      <CTA />
    </main>
  );
}
