import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";

/**
 * Thin re-export so team pages keep importing from components/team/ (matching
 * their own module boundary) while there's exactly one empty-state
 * implementation, not a second copy drifting from the first.
 */
export const TeamEmptyState = AdminEmptyState;
