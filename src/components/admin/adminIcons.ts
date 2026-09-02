import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  CheckSquare,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Paperclip,
  Receipt,
  Settings,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import type { AdminIconName } from "@/data/adminNav";

export const adminIcons: Record<AdminIconName, LucideIcon> = {
  overview: LayoutDashboard,
  leads: Inbox,
  clients: Users,
  projects: FolderKanban,
  tasks: CheckSquare,
  files: Paperclip,
  proposals: FileText,
  contracts: FileSignature,
  invoices: Receipt,
  payments: CreditCard,
  messages: MessageSquare,
  notifications: Bell,
  team: UserCog,
  activity: Activity,
  settings: Settings,
  profile: UserRound,
};
