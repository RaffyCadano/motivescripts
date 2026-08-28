import { Link } from "react-router-dom";
import { site } from "@/data/site";

type AuthStatusScreenProps = {
  title: string;
  body: string;
  showSetupHints?: boolean;
  showLoginLink?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export function AuthStatusScreen({
  title,
  body,
  showSetupHints = false,
  showLoginLink = false,
  actionLabel,
  onAction,
}: AuthStatusScreenProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-white px-6">
      <div className="w-full max-w-md rounded-[1.25rem] border border-[var(--color-line-strong)] bg-[linear-gradient(180deg,#f4f8ff,#ffffff)] p-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
          {site.name}
        </p>
        <h1 className="mt-3 text-2xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        {showSetupHints ? (
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-strong">
            <li>Create a project at supabase.com.</li>
            <li>
              Copy the project URL and publishable key into <code className="text-ink">.env</code>.
            </li>
            <li>Restart the dev server.</li>
            <li>Invite your email under Authentication → Users.</li>
            <li>
              Set that user’s app metadata to <code className="text-ink">{`{ "role": "admin" }`}</code>.
            </li>
          </ol>
        ) : null}
        {actionLabel && onAction ? (
          <button
            type="button"
            className="mt-6 font-heading text-sm font-semibold text-ink underline-offset-2 hover:underline"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
        {showLoginLink ? (
          <p className="mt-6 text-sm text-muted">
            <Link className="font-medium text-ink underline-offset-2 hover:underline" to="/login">
              Back to login
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
