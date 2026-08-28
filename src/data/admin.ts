export type AdminStat = {
  id: string;
  label: string;
  value: string;
  supporting: string;
  tone: "neutral" | "up" | "attention";
  icon: "leads" | "projects" | "review" | "revenue" | "clients" | "messages";
};
