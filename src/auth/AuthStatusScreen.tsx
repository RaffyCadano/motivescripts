import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";

type AuthStatusScreenProps = {
  title: string;
  body: string;
  loading?: boolean;
  showSetupHints?: boolean;
  showLoginLink?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  inSiteLayout?: boolean;
};

export function AuthStatusScreen({
  title,
  body,
  loading = false,
  showSetupHints = false,
  showLoginLink = false,
  actionLabel,
  onAction,
  inSiteLayout = false,
}: AuthStatusScreenProps) {
  return (
    <main
      id={inSiteLayout ? "main" : undefined}
      className={
        inSiteLayout
          ? "relative flex items-center justify-center px-6 py-16 md:py-24"
          : "relative flex min-h-svh items-center justify-center overflow-hidden bg-white px-6 py-12"
      }
    >
      {!inSiteLayout ? (
        <>
          <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-[18rem] rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.08),transparent_64%)] blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-4 size-44 rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.05),transparent_70%)] blur-2xl" />
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-80" />
        </>
      ) : null}

      <div className="relative w-full max-w-md">
        {!inSiteLayout ? (
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
        ) : null}

        <div
          className={cn(
            "relative overflow-hidden rounded-[1.25rem] border border-[var(--color-line-strong)] bg-[linear-gradient(180deg,#f4f8ff,#ffffff)]",
            loading && "text-center",
          )}
          aria-busy={loading}
          aria-live={loading ? "polite" : undefined}
        >
          <span
            className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,#0038C8,#00C8FF)]"
            aria-hidden="true"
          />
          <div className="relative px-6 py-8 md:px-8 md:py-10">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">{site.name}</p>
            {loading ? (
              <div
                className="mx-auto mt-6 size-8 animate-spin rounded-full border-2 border-[rgb(0_80_240_/_0.16)] border-t-[var(--color-blue)]"
                role="status"
                aria-label={title}
              />
            ) : null}
            <h1 className={loading ? "sr-only" : "mt-3 text-2xl"}>{title}</h1>
            <p className={cn("text-sm leading-relaxed text-muted", loading ? "mt-5" : "mt-3")}>{body}</p>

            {showSetupHints && import.meta.env.DEV ? (
              <ol className="mt-6 list-decimal space-y-2 pl-5 text-left text-sm leading-relaxed text-muted-strong">
                <li>Create a project at supabase.com.</li>
                <li>
                  Copy the project URL and publishable key into <code className="text-ink">.env</code>.
                </li>
                <li>Restart the dev server.</li>
                <li>Invite your email under Authentication → Users.</li>
                <li>
                  Set <code className="text-ink">profiles.role = admin</code> for that user in SQL. Do not create
                  administrators through public signup.
                </li>
              </ol>
            ) : null}

            {actionLabel && onAction ? (
              <Button type="button" className="mt-7 w-full" size="lg" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}

            {showLoginLink ? (
              <Button to="/login" variant="secondary" className="mt-3 w-full" size="lg">
                Back to login
              </Button>
            ) : null}

            {!loading ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
