/**
 * The Project Manager menu has "Needs Attention", "Due Today", "Overdue" and "Reviews & Deliverables". They used to
 * jump to a spot on the long Overview page, so clicking one just showed the whole overview again. Each now opens
 * a page of its own, chosen by the link's #anchor, that shows only that part of the overview.
 */

export type PmFocusKey = "needs-attention" | "today-work" | "overdue" | "reviews";

export type PmFocusView = { key: PmFocusKey; title: string; description: string };

export const PM_FOCUS_VIEWS: Record<PmFocusKey, PmFocusView> = {
  "needs-attention": {
    key: "needs-attention",
    title: "Needs attention",
    description: "Everything across your projects that is waiting on you or holding work up, most urgent first.",
  },
  "today-work": {
    key: "today-work",
    title: "Due today",
    description: "Tasks due today, and what is coming up over the next few days.",
  },
  overdue: {
    key: "overdue",
    title: "Overdue",
    description: "Tasks that are past their due date.",
  },
  reviews: {
    key: "reviews",
    title: "Reviews & deliverables",
    description: "Deliverables waiting for review and the ones that need changes.",
  },
};

/** The focused view a location hash ("#overdue") asks for, or null for the normal overview. */
export function pmFocusFromHash(hash: string): PmFocusView | null {
  const key = hash.replace(/^#/, "");
  return Object.prototype.hasOwnProperty.call(PM_FOCUS_VIEWS, key) ? PM_FOCUS_VIEWS[key as PmFocusKey] : null;
}
