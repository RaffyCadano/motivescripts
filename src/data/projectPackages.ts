/**
 * The package a project was sold as: the three columns of the Pricing page's comparison table. Stored on
 * projects.package (null = not set, which is how every project that existed before this behaves: no
 * package restrictions). Same ids as pricingTiers.
 */
export const projectPackages = ["website", "growth", "custom"] as const;
export type ProjectPackage = (typeof projectPackages)[number];

export const projectPackageLabels: Record<ProjectPackage, string> = {
  website: "Website",
  growth: "Growth",
  custom: "Custom",
};

export function isProjectPackage(value: unknown): value is ProjectPackage {
  return typeof value === "string" && (projectPackages as readonly string[]).includes(value);
}

/**
 * Whether a client gets the whole portal or the essentials. The essentials (overview, scope, project,
 * approvals, feedback, messages, proposals, contracts, invoices) are what the delivery and payment gates
 * need the client to use, so every package has them. What Website leaves out is the Files library and the
 * live website status.
 *
 * A client is on the essentials only when they have active projects and every one is a Website package.
 * One Growth / Custom project (or one with no package, i.e. every project from before packages existed)
 * gives them the full portal, so nobody loses anything they already had.
 */
export function clientHasFullPortal(projects: readonly { package: ProjectPackage | null; archived: boolean }[]): boolean {
  const active = projects.filter((project) => !project.archived);
  if (active.length === 0) return true;
  return active.some((project) => project.package !== "website");
}
