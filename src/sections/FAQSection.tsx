import { MessageCircleQuestion } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { FaqItem, FaqPanel } from "@/components/FaqItem";
import { SectionHeader } from "@/components/SectionHeader";
import { faqs } from "@/data/faq";

export function FAQSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-site">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <AnimateIn>
            <div className="lg:sticky lg:top-28">
              <SectionHeader
                eyebrow="FAQ"
                title="Common questions."
                description="Straight answers on timelines, cost, hosting and ongoing support, before you get in touch."
              />
              <div className="mt-8 flex items-start gap-4 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--ms-bg-card)] p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[rgb(0_80_240_/_0.08)] text-blue">
                  <MessageCircleQuestion size={22} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-base font-semibold text-ink">Still have a question?</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Tell us about your project and we&rsquo;ll answer it directly.
                  </p>
                  <Button to="/start-a-project" variant="secondary" className="mt-4">
                    Start a Project
                  </Button>
                </div>
              </div>
            </div>
          </AnimateIn>
          <AnimateIn delay={80}>
            <FaqPanel>
              {faqs.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} group="home-faq" />
              ))}
            </FaqPanel>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}
