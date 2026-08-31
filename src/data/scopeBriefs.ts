import {
  PROPOSAL_SCOPE_INCLUDED,
  PROPOSAL_SCOPE_OPTIONAL,
  PROPOSAL_SCOPE_PRESETS,
} from "@/data/proposalPresets";

export const SCOPE_BRIEF_INCLUDED = PROPOSAL_SCOPE_INCLUDED;
export const SCOPE_BRIEF_OPTIONAL = PROPOSAL_SCOPE_OPTIONAL;
export const SCOPE_BRIEF_PAGES = PROPOSAL_SCOPE_PRESETS;

const PAGE_SET = new Set<string>(SCOPE_BRIEF_PAGES);

export type ClientScopeBrief = {
  id: string;
  clientId: string;
  selectedPages: string[];
  goal: string;
  submittedAt: string;
  updatedAt: string;
};

export function isScopeBriefPage(value: string): boolean {
  return PAGE_SET.has(value);
}

export function normalizeScopePages(pages: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const page of pages) {
    const label = page.trim();
    if (!isScopeBriefPage(label) || seen.has(label)) continue;
    seen.add(label);
    next.push(label);
  }
  return next;
}

export function defaultScopePages(): string[] {
  return [...SCOPE_BRIEF_INCLUDED];
}

export function validateScopeBrief(pages: readonly string[], goal: string): string | null {
  const selected = normalizeScopePages(pages);
  const text = goal.trim();
  if (selected.length === 0) return "Choose at least one page or setup item.";
  if (text.length < 1) return "Tell us what you want the website to do.";
  if (text.length > 2000) return "Keep that description under 2,000 characters.";
  return null;
}

export function projectDescriptionFromBrief(brief: ClientScopeBrief): string {
  const pages = brief.selectedPages.join(", ");
  return [
    `Design and develop a professional website including ${pages}.`,
    "",
    "What they want:",
    brief.goal,
  ].join("\n");
}

export function proposalScopeFromBrief(brief: ClientScopeBrief): string {
  return brief.selectedPages.join("\n");
}

export function proposalOverviewFromBrief(brief: ClientScopeBrief): string {
  return [
    "We will design and develop a professional website for this business: clear pages, a straightforward path for visitors to get in touch, and a site that works well on phones and desktops.",
    "",
    "What they asked for:",
    brief.goal,
  ].join("\n");
}

export function suggestedProjectName(businessName: string): string {
  const name = businessName.trim();
  return name ? `${name} website` : "";
}
