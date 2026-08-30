import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { site } from "@/data/site";
import { useAuth } from "@/auth/AuthProvider";
import { publicAuthLinkError, publicSignInError, publicSignInNotFound } from "@/auth/authErrors";
import { cn } from "@/lib/cn";

const welcomeNotes = [
  "See the live site and what we last shipped.",
  "Request a change when something on the business side moves.",
  "Reach the team without starting from scratch.",
];

type LoginStatus = "idle" | "sending" | "sent" | "not_found" | "rate_limit" | "error";

export function LoginPage() {
  const { configured, user, signInWithEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkFailed = searchParams.get("error") === "link";
  const accessDenied = searchParams.get("error") === "denied";
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const alert = useMemo(() => {
    if (!configured) {
      return {
        title: "Login isn’t connected yet.",
        body: import.meta.env.DEV
          ? "Add your Supabase URL and publishable key to .env, then restart the dev server."
          : "This site isn’t connected to the database. Contact MotiveScripts.",
      };
    }
    if (status === "sent") {
      return {
        title: "Check your email.",
        body: "If that address has access, we sent a sign-in link. It expires after a short time.",
      };
    }
    if (status === "not_found") {
      return publicSignInNotFound();
    }
    if (status === "rate_limit") {
      return {
        title: "Too many email attempts.",
        body: errorMessage ?? publicSignInError("rate_limit"),
      };
    }
    if (status === "error") {
      return {
        title: "We couldn’t send that link.",
        body: errorMessage ?? publicSignInError("error"),
      };
    }
    if (accessDenied && status === "idle") {
      return {
        title: "This account can’t open the dashboard.",
        body: "Only users with an assigned MotiveScripts role can open the staff or client areas.",
      };
    }
    if (linkFailed && status === "idle") {
      return {
        title: "That sign-in link didn’t work.",
        body: publicAuthLinkError(),
      };
    }
    return null;
  }, [accessDenied, configured, errorMessage, linkFailed, status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || status === "sending") return;

    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setStatus("sending");
    setErrorMessage(null);

    const result = await signInWithEmail(email);
    if (result.ok) {
      setStatus("sent");
      return;
    }
    if (result.reason === "not_found") {
      setStatus("not_found");
      return;
    }
    if (result.reason === "rate_limit") {
      setErrorMessage(result.message ?? null);
      setStatus("rate_limit");
      return;
    }
    if (result.reason === "unconfigured") {
      setStatus("idle");
      return;
    }
    setErrorMessage(result.message ?? null);
    setStatus("error");
  }

  return (
    <main id="main" className="relative">
      <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-[18rem] rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.08),transparent_64%)] blur-2xl" />
      <div className="pointer-events-none absolute -left-10 bottom-4 size-44 rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.05),transparent_70%)] blur-2xl" />
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-80" />

      <div className="container-wide relative grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-20 lg:py-24">
        <AnimateIn>
          <p className="eyebrow">Welcome</p>
          <h1 className="mt-5 max-w-[12ch] text-[2.15rem] md:text-[3.25rem]">Welcome back.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            This is your project space. Come in to review the website, ask for an update, or pick up
            where we left off.
          </p>
          <ul className="mt-8 space-y-3">
            {welcomeNotes.map((note) => (
              <li key={note} className="flex gap-3 text-sm text-muted-strong">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
        </AnimateIn>

        <AnimateIn delay={80}>
          <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--color-line-strong)] bg-[linear-gradient(180deg,#f4f8ff,#ffffff)]">
            <span
              className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,#0038C8,#00C8FF)]"
              aria-hidden="true"
            />
            <div className="relative px-6 py-8 md:px-10 md:py-10">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
                Account access
              </p>
              <h2 className="mt-3 text-2xl">Sign in with your email.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                We’ll send a sign-in link to this address. Staff and clients use the same login.
              </p>

              <form className="mt-8" onSubmit={onSubmit}>
                <label className="block font-heading text-sm font-semibold text-ink" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  disabled={!configured || status === "sending" || status === "sent"}
                  className={cn(inputClass, Boolean(alert) && "border-[rgb(0_80_240_/_0.45)]")}
                />

                {alert ? (
                  <div
                    className={cn(
                      "mt-5 border-l-2 pl-4",
                      status === "not_found" ? "border-[var(--color-line-strong)]" : "border-cyan",
                    )}
                    role="status"
                  >
                    <p className="font-heading text-base font-semibold text-ink">{alert.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{alert.body}</p>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="mt-7 w-full"
                  size="lg"
                  disabled={!configured || status === "sending" || status === "sent"}
                >
                  {status === "sending" ? "Sending link…" : status === "sent" ? "Link sent" : "Login"}
                </Button>

                {user ? (
                  <button
                    type="button"
                    className="mt-3 w-full text-center font-heading text-sm font-semibold text-ink underline-offset-2 hover:underline"
                    onClick={() => {
                      void signOut().then(() => navigate("/login", { replace: true }));
                    }}
                  >
                    Sign out
                  </button>
                ) : null}
              </form>

              <p className="mt-8 border-t border-[var(--color-line)] pt-5 text-sm leading-relaxed text-muted">
                Need help?{" "}
                <a
                  className="font-medium text-ink underline-offset-2 hover:underline"
                  href={`mailto:${site.email}`}
                >
                  Email us directly
                </a>{" "}
                and we’ll get you sorted.
              </p>
            </div>
          </div>
        </AnimateIn>
      </div>
    </main>
  );
}

const inputClass =
  "mt-2 h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-[rgb(0_80_240_/_0.55)] disabled:cursor-not-allowed disabled:bg-[rgb(247_249_252)] disabled:text-muted";
