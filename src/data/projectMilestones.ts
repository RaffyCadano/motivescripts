/**
 * Default website-delivery milestones.
 * These are the existing five project milestones, not a second workflow.
 */

const LEGACY_DESCRIPTIONS = new Set([
  "Kickoff and collect logo, photos, and written content after they accept.",
  "Layout, visual system, and page structure.",
  "Build, integrate, and refine the site.",
  "Client feedback, revisions, and approval.",
  "Walkthrough, feedback, and approval.",
  "Client Review stage.",
  "Final QA, go-live, and handoff.",
]);

export const WEBSITE_DELIVERY_MILESTONES = [
  {
    key: "discovery",
    name: "Discovery",
    aliases: ["discovery"],
    description: "Kickoff, confirm requirements, sitemap, content, and assets.",
  },
  {
    key: "design",
    name: "Design",
    aliases: ["design"],
    description: "Create and approve the visual direction and page designs.",
  },
  {
    key: "development",
    name: "Development",
    aliases: ["development"],
    description: "Build the website, integrate approved design and content, and deploy to staging.",
  },
  {
    key: "review",
    name: "QA & Client Review",
    aliases: ["qa & client review", "qa and client review", "client review", "review"],
    description: "Test the staging website, resolve issues, collect client feedback, and obtain approval.",
  },
  {
    key: "launch",
    name: "Launch",
    aliases: ["launch"],
    description: "Move the approved website into production and complete handoff.",
  },
] as const;

export type WebsiteDeliveryMilestoneKey = (typeof WEBSITE_DELIVERY_MILESTONES)[number]["key"];

export function websiteMilestoneDefinition(name: string) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return (
    WEBSITE_DELIVERY_MILESTONES.find(
      (item) => item.name.toLowerCase() === key || (item.aliases as readonly string[]).includes(key),
    ) ?? null
  );
}

export function displayMilestoneName(name: string): string {
  return websiteMilestoneDefinition(name)?.name ?? name.trim();
}

export function websiteMilestonePurpose(name: string, storedDescription = ""): string {
  const stored = storedDescription.trim();
  const definition = websiteMilestoneDefinition(name);
  if (stored && !LEGACY_DESCRIPTIONS.has(stored)) return stored;
  return definition?.description ?? stored;
}

export function defaultWebsiteMilestones() {
  return WEBSITE_DELIVERY_MILESTONES.map((item) => ({
    name: item.name,
    description: item.description,
  }));
}
