import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/cn";

type ResetStatus = "idle" | "sending" | "sent" | "not_found" | "rate_limit" | "error" | "unconfigured";

export function ForgotPasswordPage() {
  const { configured, signInWithEmail } = useAuth();
  const [status, setStatus] = useState<ResetStatus>(configured ? "idle" : "unconfigured");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || status === "sending") return;

    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setStatus("sending");
    setErrorMessage(null);

    const result = await signInWithEmail(email);
    if (result.ok || result.reason === "not_found") {
      setStatus("sent");
      return;
    }
    if (result.reason === "rate_limit") {
      setStatus("rate_limit");
      return;
    }
    if (result.reason === "unconfigured") {
      setStatus("unconfigured");
      return;
    }
    setErrorMessage(result.message ?? null);
    setStatus("error");
  }

  const done = status === "sent";

  return (
    <main id="main">
      <PageHero
        eyebrow="Login"
        title="Get a new sign-in link."
        description="Enter the email on the account. If we have a matching login, we’ll send a fresh link."
      />

      <div className="container-wide py-16 md:max-w-xl md:py-24">
        <AnimateIn>
          {done ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-8 md:p-10">
              <p className="eyebrow">Sent</p>
              <h2 className="mt-4 text-2xl">Check your email.</h2>
              <p className="mt-4 text-muted">
                If that address has access, we sent a sign-in link. It expires after a short time.
              </p>
              <p className="mt-4 text-muted">
                <Link className="font-medium text-ink underline-offset-2 hover:underline" to="/login">
                  Back to login
                </Link>
                .
              </p>
            </div>
          ) : (
            <form
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6 md:p-8"
              onSubmit={onSubmit}
            >
              <div>
                <label className="block font-heading text-sm font-semibold text-ink" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={!configured || status === "sending"}
                  className={cn(inputClass)}
                />
              </div>
              {status === "unconfigured" ? (
                <p className="mt-4 text-sm text-muted">
                  {import.meta.env.DEV
                    ? "Login isn’t connected yet. Add your Supabase keys to .env and restart the dev server."
                    : "This site isn’t connected to the database. Contact MotiveScripts."}
                </p>
              ) : null}
              {status === "rate_limit" ? (
                <p className="mt-4 text-sm text-muted">Too many attempts. Wait a minute, then try again.</p>
              ) : null}
              {status === "error" ? (
                <p className="mt-4 text-sm text-muted">{errorMessage ?? "We couldn’t send that link."}</p>
              ) : null}
              <div className="mt-7">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={!configured || status === "sending"}
                >
                  {status === "sending" ? "Sending link…" : "Send sign-in link"}
                </Button>
                <p className="mt-4 text-center text-sm text-muted">
                  <Link
                    className="font-heading font-semibold text-ink underline-offset-2 transition-colors hover:text-blue hover:underline"
                    to="/login"
                  >
                    Back to login
                  </Link>
                </p>
              </div>
            </form>
          )}
        </AnimateIn>
      </div>
    </main>
  );
}

const inputClass =
  "mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-[rgb(0_80_240_/_0.55)] disabled:cursor-not-allowed disabled:bg-[rgb(247_249_252)]";
