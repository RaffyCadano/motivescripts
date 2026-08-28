import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { services } from "@/data/services";
import { site } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-bg)]">
      <div className="container-wide grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4 lg:gap-10 lg:py-20">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">{site.tagline}</p>
        </div>

        <div>
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
            Company
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link className="text-muted-strong transition-colors hover:text-ink" to="/about">
                About
              </Link>
            </li>
            <li>
              <Link className="text-muted-strong transition-colors hover:text-ink" to="/work">
                Work
              </Link>
            </li>
            <li>
              <Link className="text-muted-strong transition-colors hover:text-ink" to="/process">
                Process
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
            Services
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {services.map((service) => (
              <li key={service.id}>
                <Link className="text-muted-strong transition-colors hover:text-ink" to={service.href}>
                  {service.footerLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
            Contact
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                className="text-muted-strong transition-colors hover:text-ink"
                to="/start-a-project"
              >
                Start a Project
              </Link>
            </li>
            <li>
              <a
                className="text-muted-strong transition-colors hover:text-ink"
                href={`mailto:${site.email}`}
              >
                {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide flex flex-col gap-2 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 MotiveScripts. All rights reserved.</p>
          <p>Websites for small businesses.</p>
        </div>
      </div>
    </footer>
  );
}
