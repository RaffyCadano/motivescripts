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
import { WorkSection } from "@/sections/WorkSection";
import { usePageMeta } from "@/lib/usePageMeta";

export function HomePage() {
  usePageMeta(
    "MotiveScripts — Websites that turn visitors into customers",
    "MotiveScripts designs and builds fast, modern websites for small businesses that want more calls, bookings, and customers.",
    "/",
  );
  return (
    <main id="main">
      <HeroSection />
      <TrustSection />
      <ServicesSection />
      <WhySection />
      <WorkSection />
      <ProcessSection />
      <PricingSection />
      <TestimonialsSection />
      <AboutTeaserSection />
      <FAQSection />
      <CTA />
    </main>
  );
}
