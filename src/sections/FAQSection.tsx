import { AnimateIn } from "@/components/AnimateIn";
import { FaqItem } from "@/components/FaqItem";
import { SectionHeader } from "@/components/SectionHeader";
import { faqs } from "@/data/faq";

export function FAQSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-site">
        <AnimateIn>
          <SectionHeader eyebrow="FAQ" title="Common questions." />
        </AnimateIn>
        <AnimateIn delay={80}>
          <div className="mt-10">
            {faqs.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
