import { Link } from "react-router-dom";
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

export function TermsPage() {
  const meta = seoPage("/terms");
  usePageMeta(meta.title, meta.description, meta.path);

  return (
    <main id="main">
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        description={`Last updated: ${LAST_UPDATED}. These terms cover using our website, client portal, and services.`}
      />

      <div className="container-wide py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-12">
          <AnimateIn>
            <p className="text-[15px] leading-relaxed text-muted">
              By using MotiveScripts's website, client portal, or services, you agree to these
              terms. If a signed proposal or contract covers your specific project, its terms
              govern that project wherever it conflicts with the general terms below.
            </p>
          </AnimateIn>

          <AnimateIn>
            <Section title="Our services">
              <p>
                MotiveScripts designs, builds, and maintains websites for small and local
                businesses. Services generally fall into two categories:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-ink">One-time website projects</strong> — the scope,
                  price, timeline, and deliverables for a specific project are set out in your
                  accepted proposal and, where applicable, your signed contract.
                </li>
                <li>
                  <strong className="text-ink">Website Care</strong> — an optional, recurring
                  monthly plan covering hosting coordination, SSL, uptime monitoring, automated
                  backups, and ongoing updates, billed on a subscription basis through Stripe. What
                  each tier includes is shown in the client portal and on our{" "}
                  <Link viewTransition className="font-medium text-ink underline-offset-2 hover:underline" to="/pricing">
                    pricing page
                  </Link>{" "}
                  at the time you choose it.
                </li>
              </ul>
              <p>
                Website Care's automated backups capture and retain a snapshot of your website's
                live content on a regular schedule, for recovery reference. Hosting for your
                website is provided by your own hosting account, not by MotiveScripts, so this is
                not a substitute for your host's own backups, and we cannot guarantee your host's
                uptime or data retention.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Accounts and the client portal">
              <p>
                If we build a client portal account for you, you're responsible for keeping your
                login credentials secure and for all activity under your account. Tell us right
                away if you suspect unauthorized access.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Payments and billing">
              <p>
                Payments are processed by Stripe. One-time project invoices follow the payment
                terms in your proposal or contract. Website Care and other recurring plans are
                billed automatically each period until canceled; you can cancel or pause a plan any
                time from the client portal, effective as described there at the time you do so.
              </p>
              <p>
                A missed or failed payment may pause work on your project or suspend a Website Care
                plan's active benefits until it's resolved.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="AI-assisted features">
              <p>
                Some parts of our website and client portal use AI (including a client-messaging
                assistant that may respond before a team member joins). AI-generated responses can
                be incomplete or inaccurate, are not professional, legal, or financial advice, and
                don't represent a binding commitment from MotiveScripts — a team member reviews and
                is responsible for anything that becomes a project decision, quote, or deliverable.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Acceptable use">
              <p>You agree not to use our website, portal, or services to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Violate any applicable law</li>
                <li>Upload or transmit anything unlawful, infringing, or harmful</li>
                <li>Attempt to gain unauthorized access to our systems or another client's data</li>
                <li>Interfere with or disrupt the operation of our website or portal</li>
              </ul>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Intellectual property">
              <p>
                Once you've paid in full for a project, you own the final website deliverables built
                for you, except for any third-party assets (stock photos, fonts, plugins, and
                similar) that remain licensed under their own terms. Until paid in full, deliverables
                remain MotiveScripts's property. We may display completed work in our portfolio and
                case studies unless we've agreed otherwise with you in writing.
              </p>
              <p>
                This website's own content, design, and code belong to MotiveScripts and may not be
                copied or reused without permission.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Third-party services">
              <p>
                Our services rely on third-party providers (including Stripe, Supabase, Resend, and
                Anthropic) and may link to or integrate with other third-party services your project
                needs. We aren't responsible for those providers' own terms, availability, or
                conduct.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Disclaimer of warranties">
              <p>
                Our website and portal are provided "as is." We work to keep them accurate and
                available, but we don't guarantee they'll be uninterrupted, error-free, or fit for a
                particular purpose beyond what's specifically promised in your proposal or contract.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Limitation of liability">
              <p>
                To the extent allowed by law, MotiveScripts is not liable for indirect, incidental,
                or consequential damages arising from your use of our website, portal, or services.
                Our total liability for any claim relating to a project is limited to the amount you
                paid us for that project.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Termination">
              <p>
                We may suspend or terminate access to the client portal for a violation of these
                terms or nonpayment. You can stop using our website or close your account at any
                time; project-specific termination is governed by your proposal or contract.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Governing law">
              <p>These terms are governed by the laws of the State of North Carolina, USA, without regard to conflict-of-law principles.</p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Changes to these terms">
              <p>
                We may update these terms from time to time. If we make a material change, we'll
                update the date at the top of this page. Continuing to use our services after a
                change means you accept the updated terms.
              </p>
            </Section>
          </AnimateIn>

          <AnimateIn>
            <Section title="Contact us">
              <p>
                Questions about these terms? Email us at{" "}
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
