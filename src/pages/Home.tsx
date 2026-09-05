import { CTA } from "@/components/CTA";
import { HeroSection } from "@/sections/HeroSection";
import { IntroSection } from "@/sections/IntroSection";
import { ProcessSection } from "@/sections/ProcessSection";
import { ServicesSection } from "@/sections/ServicesSection";
import { WhySection } from "@/sections/WhySection";
import { WorkSection } from "@/sections/WorkSection";
import { usePageMeta } from "@/lib/usePageMeta";

export function HomePage() {
  usePageMeta(
    "MotiveScripts — Websites for growing businesses",
    "MotiveScripts designs and develops professional websites for small businesses. Strategy, design, development, and support — from first conversation to launch.",
  );
  return (
    <main id="main">
      <HeroSection />
      <IntroSection />
      <ServicesSection />
      <WorkSection />
      <ProcessSection />
      <WhySection />
      <CTA />
    </main>
  );
}
