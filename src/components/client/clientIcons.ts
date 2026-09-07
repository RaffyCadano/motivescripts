import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardList,
  FileSignature,
  FileText,
  Files,
  FolderKanban,
  Home,
  MessageSquare,
  MessageSquareQuote,
  Receipt,
  Settings,
  LifeBuoy,
} from "lucide-react";
import type { ClientIconName } from "@/data/clientNav";

export const clientIcons: Record<ClientIconName, LucideIcon> = {
  overview: Home,
  scope: ClipboardList,
  project: FolderKanban,
  files: Files,
  feedback: MessageSquareQuote,
  approvals: BadgeCheck,
  support: LifeBuoy,
  messages: MessageSquare,
  proposals: FileText,
  contracts: FileSignature,
  invoices: Receipt,
  settings: Settings,
};
