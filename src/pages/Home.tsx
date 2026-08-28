import { CTA } from "@/components/CTA";
import { HeroSection } from "@/sections/HeroSection";
import { IntroSection } from "@/sections/IntroSection";
import { ProcessSection } from "@/sections/ProcessSection";
import { ServicesSection } from "@/sections/ServicesSection";
import { WhySection } from "@/sections/WhySection";
import { WorkSection } from "@/sections/WorkSection";

export function HomePage() {
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
