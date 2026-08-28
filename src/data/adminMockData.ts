export type LeadStatus = "New" | "Contacted" | "Qualified" | "Won" | "Lost";
export type ProjectStage = "Design" | "Development" | "Client Review";

export type AdminStat = {
  id: string;
  label: string;
  value: string;
  supporting: string;
  tone: "neutral" | "up" | "attention";
  icon: "leads" | "projects" | "review" | "revenue";
};

export type AdminLead = {
  id: string;
  business: string;
  industry: string;
  request: string;
  status: LeadStatus;
  date: string;
};

export type AdminProject = {
  id: string;
  name: string;
  client: string;
  stage: ProjectStage;
  progress: number;
  deadline: string;
};

export type AdminActivity = {
  id: string;
  description: string;
  time: string;
  related?: string;
  icon: "approval" | "lead" | "invoice" | "file" | "status";
};

export const adminUser = {
  name: "Raffy",
  role: "Admin",
  initials: "R",
} as const;

export const adminStats: AdminStat[] = [
  {
    id: "leads",
    label: "New Leads",
    value: "12",
    supporting: "+3 this week",
    tone: "up",
    icon: "leads",
  },
  {
    id: "projects",
    label: "Active Projects",
    value: "5",
    supporting: "2 due this week",
    tone: "neutral",
    icon: "projects",
  },
  {
    id: "review",
    label: "Awaiting Review",
    value: "2",
    supporting: "Client action required",
    tone: "attention",
    icon: "review",
  },
  {
    id: "revenue",
    label: "Revenue",
    value: "$4,850",
    supporting: "This month",
    tone: "up",
    icon: "revenue",
  },
];

export const adminLeads: AdminLead[] = [
  {
    id: "lead-1",
    business: "ABC Landscaping",
    industry: "Landscaping",
    request: "New Website",
    status: "New",
    date: "Today",
  },
  {
    id: "lead-2",
    business: "Smith Auto",
    industry: "Auto",
    request: "Website Redesign",
    status: "Contacted",
    date: "Yesterday",
  },
  {
    id: "lead-3",
    business: "XYZ Cleaning",
    industry: "Cleaning",
    request: "New Website",
    status: "New",
    date: "2 days ago",
  },
  {
    id: "lead-4",
    business: "Koala Trees Services",
    industry: "Tree Service",
    request: "Website Development",
    status: "Qualified",
    date: "3 days ago",
  },
];

export const adminProjects: AdminProject[] = [
  {
    id: "proj-1",
    name: "ABC Landscaping Website",
    client: "ABC Landscaping",
    stage: "Development",
    progress: 72,
    deadline: "Sep 12",
  },
  {
    id: "proj-2",
    name: "Smith Auto Redesign",
    client: "Smith Auto",
    stage: "Design",
    progress: 45,
    deadline: "Sep 19",
  },
  {
    id: "proj-3",
    name: "XYZ Services Landing Page",
    client: "XYZ Services",
    stage: "Client Review",
    progress: 90,
    deadline: "Aug 29",
  },
];

export const adminActivity: AdminActivity[] = [
  {
    id: "act-1",
    description: "Client approved Homepage V2",
    time: "10:42 AM",
    related: "ABC Landscaping",
    icon: "approval",
  },
  {
    id: "act-2",
    description: "New project inquiry received",
    time: "9:15 AM",
    related: "Smith Auto",
    icon: "lead",
  },
  {
    id: "act-3",
    description: "Invoice #1024 was paid",
    time: "Yesterday",
    related: "XYZ Services",
    icon: "invoice",
  },
  {
    id: "act-4",
    description: "Homepage V3 uploaded",
    time: "Yesterday",
    related: "ABC Landscaping",
    icon: "file",
  },
  {
    id: "act-5",
    description: "Project status changed to Client Review",
    time: "2 days ago",
    related: "XYZ Services",
    icon: "status",
  },
];
