import { Button } from "@/components/Button";

export function NotFoundPage() {
  return (
    <main id="main" className="container-site py-24 md:py-32">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-4xl">Page not found</h1>
      <p className="mt-4 max-w-md text-muted">That page doesn’t exist. Head back to the homepage or start a project.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button to="/" size="lg">
          Home
        </Button>
        <Button to="/start-a-project" variant="secondary" size="lg">
          Start a Project
        </Button>
      </div>
    </main>
  );
}
