import { Briefcase, Car, HardHat, House, SprayCan, Store, TreePine, Utensils, type LucideIcon } from "lucide-react";
import type { clientTypes } from "@/data/site";

// Keyed by client type (a typed literal from site.ts), so adding a type there without an icon here is a
// type error rather than a card with a missing icon.
export const clientTypeIcons: Record<(typeof clientTypes)[number], LucideIcon> = {
  "Home service businesses": House,
  Contractors: HardHat,
  "Landscaping and tree services": TreePine,
  "Cleaning companies": SprayCan,
  "Restaurants and salons": Utensils,
  "Auto shops": Car,
  "Professional services": Briefcase,
  "Other local businesses": Store,
};
