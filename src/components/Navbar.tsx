import { useEffect, useId, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const titleId = useId();

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    close();
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) close();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.classList.add("nav-open");
    else root.classList.remove("nav-open");

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    if (open) window.addEventListener("keydown", onKey);

    return () => {
      root.classList.remove("nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed left-0 top-0 z-[60] w-full border-b transition-[background-color,border-color,box-shadow] duration-[var(--duration-base)]",
          scrolled || open
            ? "nav-blur border-[var(--color-line)]"
            : "border-transparent bg-transparent",
        )}
      >
      <div className="container-wide relative z-50 flex h-[var(--nav-height)] items-center justify-between gap-3 sm:gap-6">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {site.nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "relative font-heading text-sm font-semibold tracking-tight text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink",
                  isActive && "text-ink after:absolute after:inset-x-0 after:-bottom-2 after:h-px after:bg-[linear-gradient(90deg,#0050F0,#00C8FF)]",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button to="/login" variant="secondary" size="md">
            Login
          </Button>
          <Button to="/start-a-project" size="md">
            Start a Project
          </Button>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] text-ink lg:ml-0 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="relative block h-3.5 w-[18px]" aria-hidden="true">
            <span
              className={cn(
                "absolute left-0 h-0.5 w-full rounded-full bg-ink transition-transform duration-[var(--duration-base)]",
                open ? "top-1.5 rotate-45" : "top-0",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-1.5 h-0.5 w-full rounded-full bg-ink transition-opacity duration-[var(--duration-base)]",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "absolute left-0 h-0.5 w-full rounded-full bg-ink transition-transform duration-[var(--duration-base)]",
                open ? "top-1.5 -rotate-45" : "top-3",
              )}
            />
          </span>
        </button>
      </div>
    </header>
    <div className="h-[var(--nav-height)]" aria-hidden="true" />

      <div
        id="mobile-nav"
        className={cn(
          "fixed left-0 top-[var(--nav-height)] z-50 w-full lg:hidden",
          "h-[calc(100dvh-var(--nav-height))] border-t border-[var(--color-line)] bg-[var(--color-bg)]",
          open ? "flex" : "hidden",
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto px-[var(--gutter)] pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
          <p id={titleId} className="sr-only">
            Site menu
          </p>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {site.nav.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "rounded-[var(--radius-md)] px-3 py-3 font-heading text-lg font-semibold text-muted-strong",
                    isActive && "bg-[var(--color-bg-card)] text-ink",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 pt-8">
            <Button to="/login" variant="secondary" className="w-full" size="lg">
              Login
            </Button>
            <Button to="/start-a-project" className="w-full" size="lg">
              Start a Project
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
