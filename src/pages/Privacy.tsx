import { AnimateIn } from "@/components/AnimateIn";
import { PageHero } from "@/components/PageHero";
import { site } from "@/data/site";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

const LAST_UPDATED = "September 22, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl md:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  const meta = seoPage("/privacy");
  usePageMeta(meta.title, meta.description, meta.path);

  return (
    <main id="main">
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description={`Last updated: ${LAST_UPDATED}. This explains what MotiveScripts collects, how it's used, and who we share it with.`}
      />

      <div className="container-wide py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-12">
          <AnimateIn>
            <p className="text-[15px] leading-relaxed text-muted">
              MotiveScripts ("MotiveScripts," "we," "us") builds and maintains websites for small
              businesses. This policy covers our public website, the client portal, and the team
              tools we use to deliver those services. It does not cover the websites we build for
              clients — those are governed by that business's own privacy policy.
            </p>
          </AnimateIn>

          <AnimateIn>
            <Section title="Information we collect">
              <p>
                <strong className="text-ink">Information you give us directly:</strong> your name,
                business name, email, phone number, and project details when you submit the Start a
                Project form, request a proposal, or message us; your account information, project
                files, and messages if you use the client portal; and payment details when you pay
                an invoice or subscribe to a Website Care plan.
              </p>
              <p>
                <strong className="text-ink">Information collected automatically:</strong> standard
                technical information any web server logs, like IP address, browser type, and pages
                visited, used only to keep the site running and secure. We do not use cookies,
                advertising pixels, or third-party analytics or tracking scripts on this site.
              </p>
              <p>
                <strong className="text-ink">Payment information:</strong> card and billing details
                are collected and processed directly by Stripe, our payment processor. We never see
                or store your full card number — our records hold only the amount, date, and
                Stripe's own reference for each transaction.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="How we use information">
              <ul className="list-disc space-y-2 pl-5">
                <li>To respond to inquiries and prepare proposals</li>
                <li>To build, deliver, and support your website and any ongoing Website Care plan</li>
                <li>To process payments and send invoices and receipts</li>
                <li>To send account, project, and billing communications</li>
                <li>To maintain the security and reliability of our systems</li>
              </ul>
              <p>We do not sell your personal information, and we do not use it for advertising.</p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="AI-assisted features">
              <p>
                Our public website includes an optional AI assistant that answers questions about
                our services. Its conversations exist only in your browser for that visit — we
                don't store them on our servers or connect them to your identity.
              </p>
              <p>
                Client portal conversations may also be answered first by an AI assistant before a
                team member joins, to gather details about what you need. Those messages are stored
                as part of your project's message history, the same as a message from our team, and
                are sent to our AI provider (Anthropic) to generate a reply.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Who we share information with">
              <p>
                We don't sell or rent your information. We share it only with the service providers
                that run our business, each of whom only receives what they need to do their job:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-ink">Supabase</strong> — hosts our database, file storage,
                  and account sign-in
                </li>
                <li>
                  <strong className="text-ink">Stripe</strong> — processes payments and stores
                  payment methods
                </li>
                <li>
                  <strong className="text-ink">Resend</strong> — delivers account and project emails
                </li>
                <li>
                  <strong className="text-ink">Anthropic</strong> — powers our AI assistants
                </li>
                <li>
                  <strong className="text-ink">GitHub Pages</strong> — hosts this website
                </li>
              </ul>
              <p>
                We may also disclose information if required by law, or to protect the rights,
                property, or safety of MotiveScripts, our clients, or others.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Data retention">
              <p>
                We keep information for as long as needed to provide our services, maintain business
                records, and meet legal and tax obligations. If you'd like your information deleted
                sooner, contact us and we'll do so unless we're required to keep it.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Data security">
              <p>
                We rely on our service providers' security practices (encryption in transit,
                access controls, and industry-standard infrastructure) and limit access to client
                data to the team members who need it to do their work. No method of storing or
                transmitting data is completely secure, so we can't guarantee absolute security.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Your choices">
              <p>
                You can ask us to access, correct, or delete the personal information we hold about
                you at any time by emailing{" "}
                <a className="font-medium text-ink underline-offset-2 hover:underline" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
                . Client portal users can also update most of their own information directly from
                account settings.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Children's privacy">
              <p>
                Our services are intended for businesses and the adults who run them, not children.
                We don't knowingly collect personal information from anyone under 13.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Changes to this policy">
              <p>
                If we make a material change to this policy, we'll update the date at the top of
                this page. Continuing to use our services after a change means you accept the
                updated policy.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Contact us">
              <p>
                Questions about this policy or your information? Email us at{" "}
                <a className="font-medium text-ink underline-offset-2 hover:underline" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
                .
              </p>
            </Section>
          </AnimateIn>
        </div>
      </div>
    </main>
  );
}
