import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  FileSignature,
  FileText,
  Files,
  FolderKanban,
  Home,
  MessageSquare,
  MessageSquareQuote,
  Receipt,
  Settings,
} from "lucide-react";
import type { ClientIconName } from "@/data/clientNav";

export const clientIcons: Record<ClientIconName, LucideIcon> = {
  overview: Home,
  project: FolderKanban,
  files: Files,
  feedback: MessageSquareQuote,
  approvals: BadgeCheck,
  messages: MessageSquare,
  proposals: FileText,
  contracts: FileSignature,
  invoices: Receipt,
  settings: Settings,
};
